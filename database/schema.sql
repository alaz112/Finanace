-- =============================================================================
-- Finance Tracker Platform — Database Schema
-- PostgreSQL + TimescaleDB
-- =============================================================================

-- TimescaleDB extension (TimescaleDB ile deploy edilmeli)
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- ENUM TYPES
-- =============================================================================

CREATE TYPE asset_type      AS ENUM ('PRECIOUS_METAL', 'FOREX', 'CRYPTO', 'EQUITY');
CREATE TYPE transaction_type AS ENUM ('BUY', 'SELL', 'TRANSFER_IN', 'TRANSFER_OUT');
CREATE TYPE order_status    AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'FAILED');
CREATE TYPE price_source    AS ENUM ('ALPHA_VANTAGE', 'TWELVE_DATA', 'MANUAL', 'WEBSOCKET');

-- =============================================================================
-- USERS
-- =============================================================================

CREATE TABLE users (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT         NOT NULL,           -- bcrypt / argon2id hash
    full_name       VARCHAR(150),
    preferred_currency  CHAR(3)  NOT NULL DEFAULT 'USD',
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    is_verified     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users (email);

-- =============================================================================
-- ASSETS  (XAU, CHF/USD, EUR/CHF, vb.)
-- =============================================================================

CREATE TABLE assets (
    id              SERIAL       PRIMARY KEY,
    symbol          VARCHAR(20)  NOT NULL UNIQUE,   -- "XAU", "CHF", "XAUUSD", "USDCHF"
    name            VARCHAR(100) NOT NULL,           -- "Gold (Troy Ounce)", "Swiss Franc"
    asset_type      asset_type   NOT NULL,
    base_currency   CHAR(3)      NOT NULL,           -- XAU, USD, EUR ...
    quote_currency  CHAR(3)      NOT NULL DEFAULT 'USD',
    decimal_places  SMALLINT     NOT NULL DEFAULT 4,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    description     TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Temel varlıkları seed et
INSERT INTO assets (symbol, name, asset_type, base_currency, quote_currency, decimal_places) VALUES
    ('XAU/USD', 'Gold / US Dollar (Troy Ounce)', 'PRECIOUS_METAL', 'XAU', 'USD', 2),
    ('USD/CHF', 'US Dollar / Swiss Franc',        'FOREX',          'USD', 'CHF', 4),
    ('MRVL',    'Marvell Technology Inc.',         'EQUITY',         'USD', 'USD', 2),
    ('AVGO',    'Broadcom Inc.',                   'EQUITY',         'USD', 'USD', 2);

-- =============================================================================
-- PORTFOLIOS
-- =============================================================================

CREATE TABLE portfolios (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    base_currency   CHAR(3)     NOT NULL DEFAULT 'USD',
    is_default      BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_portfolios_user_id ON portfolios (user_id);

-- Bir kullanıcının yalnızca bir varsayılan portföyü olabilir
CREATE UNIQUE INDEX idx_portfolios_one_default
    ON portfolios (user_id)
    WHERE is_default = TRUE;

-- =============================================================================
-- TRANSACTIONS  (alım / satım geçmişi)
-- =============================================================================

CREATE TABLE transactions (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    portfolio_id        UUID            NOT NULL REFERENCES portfolios (id) ON DELETE CASCADE,
    asset_id            INTEGER         NOT NULL REFERENCES assets (id),
    transaction_type    transaction_type NOT NULL,
    status              order_status    NOT NULL DEFAULT 'COMPLETED',

    -- Miktar ve fiyat bilgisi
    quantity            NUMERIC(20, 8)  NOT NULL CHECK (quantity > 0),
    price_per_unit      NUMERIC(20, 8)  NOT NULL CHECK (price_per_unit > 0),
    total_amount        NUMERIC(20, 8)  NOT NULL GENERATED ALWAYS AS (quantity * price_per_unit) STORED,
    fee                 NUMERIC(20, 8)  NOT NULL DEFAULT 0 CHECK (fee >= 0),
    fee_currency        CHAR(3)         NOT NULL DEFAULT 'USD',

    -- Kur bilgisi (işlem anındaki oranlar kaydedilir)
    exchange_rate_to_usd    NUMERIC(20, 8),   -- İşlem para biriminin USD karşılığı

    -- Meta
    transaction_date    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    notes               TEXT,
    external_ref        VARCHAR(100),   -- Borsadan gelen referans numarası
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_portfolio_id ON transactions (portfolio_id);
CREATE INDEX idx_transactions_asset_id     ON transactions (asset_id);
CREATE INDEX idx_transactions_date         ON transactions (transaction_date DESC);
CREATE INDEX idx_transactions_portfolio_asset
    ON transactions (portfolio_id, asset_id, transaction_date DESC);

-- =============================================================================
-- PRICE HISTORY  (TimescaleDB Hypertable — zaman serisi)
-- =============================================================================

CREATE TABLE price_history (
    time        TIMESTAMPTZ     NOT NULL,
    asset_id    INTEGER         NOT NULL REFERENCES assets (id),
    open        NUMERIC(20, 8)  NOT NULL,
    high        NUMERIC(20, 8)  NOT NULL,
    low         NUMERIC(20, 8)  NOT NULL,
    close       NUMERIC(20, 8)  NOT NULL,
    volume      NUMERIC(30, 8),
    source      price_source    NOT NULL DEFAULT 'ALPHA_VANTAGE',

    PRIMARY KEY (time, asset_id)
);

-- TimescaleDB hypertable: time sütununa göre otomatik partition
SELECT create_hypertable(
    'price_history',
    'time',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists       => TRUE
);

-- Not: Sıkıştırma politikası columnstore aktif edilince eklenecek
-- SELECT add_compression_policy('price_history', INTERVAL '30 days');

-- Veri saklama politikası: 5 yıldan eski veriler silinir (opsiyonel)
-- SELECT add_retention_policy('price_history', INTERVAL '5 years');

CREATE INDEX idx_price_history_asset_time
    ON price_history (asset_id, time DESC);

-- =============================================================================
-- PRICE_ALERTS  (kullanıcı fiyat alarmları)
-- =============================================================================

CREATE TABLE price_alerts (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    asset_id        INTEGER     NOT NULL REFERENCES assets (id),
    target_price    NUMERIC(20, 8) NOT NULL,
    direction       VARCHAR(10) NOT NULL CHECK (direction IN ('ABOVE', 'BELOW')),
    is_triggered    BOOLEAN     NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    triggered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_price_alerts_user_id ON price_alerts (user_id);
CREATE INDEX idx_price_alerts_active
    ON price_alerts (asset_id, is_active)
    WHERE is_active = TRUE;

-- =============================================================================
-- VIEWs
-- =============================================================================

-- Portfolio Holdings View: her varlık için ortalama maliyet (WAC) ve toplam pozisyon
CREATE OR REPLACE VIEW vw_portfolio_holdings AS
SELECT
    t.portfolio_id,
    t.asset_id,
    a.symbol,
    a.name                                                          AS asset_name,
    a.asset_type,

    -- Net miktar (alım - satım)
    SUM(
        CASE t.transaction_type
            WHEN 'BUY'         THEN  t.quantity
            WHEN 'TRANSFER_IN' THEN  t.quantity
            WHEN 'SELL'        THEN -t.quantity
            WHEN 'TRANSFER_OUT'THEN -t.quantity
        END
    )                                                               AS net_quantity,

    -- Weighted Average Cost (WAC) — yalnızca alım işlemleri dahil edilir
    SUM(
        CASE WHEN t.transaction_type IN ('BUY', 'TRANSFER_IN')
             THEN t.quantity * t.price_per_unit ELSE 0 END
    ) /
    NULLIF(SUM(
        CASE WHEN t.transaction_type IN ('BUY', 'TRANSFER_IN')
             THEN t.quantity ELSE 0 END
    ), 0)                                                           AS avg_cost_per_unit,

    -- Toplam maliyet (fee dahil)
    SUM(
        CASE WHEN t.transaction_type IN ('BUY', 'TRANSFER_IN')
             THEN t.total_amount + t.fee ELSE 0 END
    )                                                               AS total_cost_basis,

    SUM(
        CASE WHEN t.transaction_type IN ('SELL', 'TRANSFER_OUT')
             THEN t.total_amount - t.fee ELSE 0 END
    )                                                               AS total_proceeds,

    COUNT(*)                                                        AS transaction_count,
    MAX(t.transaction_date)                                         AS last_transaction_date

FROM transactions t
JOIN assets a ON a.id = t.asset_id
WHERE t.status = 'COMPLETED'
GROUP BY t.portfolio_id, t.asset_id, a.symbol, a.name, a.asset_type
HAVING SUM(
    CASE t.transaction_type
        WHEN 'BUY'         THEN  t.quantity
        WHEN 'TRANSFER_IN' THEN  t.quantity
        WHEN 'SELL'        THEN -t.quantity
        WHEN 'TRANSFER_OUT'THEN -t.quantity
    END
) > 0;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- updated_at otomatik güncelleme trigger fonksiyonu
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_portfolios_updated_at
    BEFORE UPDATE ON portfolios
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
