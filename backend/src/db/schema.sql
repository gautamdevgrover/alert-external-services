-- CyberForce Monitoring & Alerting Database Schema

CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    website VARCHAR(255),
    is_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS service_credentials_reference (
    id SERIAL PRIMARY KEY,
    service_key VARCHAR(50) REFERENCES services(key) ON DELETE CASCADE,
    env_var_names TEXT[] NOT NULL,
    is_configured BOOLEAN DEFAULT FALSE NOT NULL,
    last_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS threshold_config (
    id SERIAL PRIMARY KEY,
    service_key VARCHAR(50) UNIQUE REFERENCES services(key) ON DELETE CASCADE,
    warning_threshold NUMERIC NOT NULL,
    critical_threshold NUMERIC NOT NULL,
    unit VARCHAR(20) NOT NULL,
    comparison VARCHAR(20) NOT NULL DEFAULT 'less_than', -- 'less_than' for balance/credits; 'greater_than' for spend/usage
    alert_cooldown_minutes INTEGER DEFAULT 360 NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS monitoring_results (
    id BIGSERIAL PRIMARY KEY,
    service_key VARCHAR(50) REFERENCES services(key) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL, -- 'healthy', 'warning', 'critical', 'down', 'manual'
    metric_type VARCHAR(20) NOT NULL, -- 'credits', 'balance', 'spend', 'usage', 'manual'
    current_spend NUMERIC,
    forecasted_spend NUMERIC,
    budget NUMERIC,
    used NUMERIC,
    limit_val NUMERIC,
    remaining NUMERIC,
    percentage_used NUMERIC,
    currency VARCHAR(10) DEFAULT 'USD',
    threshold_status VARCHAR(20) NOT NULL DEFAULT 'normal', -- 'normal', 'warning', 'critical'
    raw_metadata JSONB,
    error_code VARCHAR(50),
    error_message TEXT,
    response_time_ms INTEGER DEFAULT 0,
    checked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_monitoring_results_service_checked ON monitoring_results(service_key, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitoring_results_checked_at ON monitoring_results(checked_at DESC);

CREATE TABLE IF NOT EXISTS usage_snapshots (
    id BIGSERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    service_key VARCHAR(50) REFERENCES services(key) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    metric_type VARCHAR(20) NOT NULL,
    usage_val NUMERIC,
    remaining_val NUMERIC,
    cost_val NUMERIC,
    percentage_used NUMERIC,
    threshold_status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_snapshot_date_service UNIQUE (snapshot_date, service_key)
);

CREATE INDEX IF NOT EXISTS idx_usage_snapshots_service_date ON usage_snapshots(service_key, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS alerts (
    id BIGSERIAL PRIMARY KEY,
    service_key VARCHAR(50) REFERENCES services(key) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'warning', 'critical', 'info'
    message TEXT NOT NULL,
    details JSONB,
    status VARCHAR(20) DEFAULT 'active' NOT NULL, -- 'active', 'resolved'
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_service ON alerts(service_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status, created_at DESC);

CREATE TABLE IF NOT EXISTS alert_state (
    service_key VARCHAR(50) PRIMARY KEY REFERENCES services(key) ON DELETE CASCADE,
    current_state VARCHAR(20) NOT NULL DEFAULT 'HEALTHY', -- 'HEALTHY', 'WARNING', 'CRITICAL', 'DOWN'
    last_alert_type VARCHAR(50),
    last_alert_at TIMESTAMPTZ,
    last_state_change_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    cooldown_until TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS monitoring_runs (
    id BIGSERIAL PRIMARY KEY,
    run_type VARCHAR(20) NOT NULL, -- 'scheduled', 'manual', 'snapshot'
    started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMPTZ,
    total_services INTEGER DEFAULT 0,
    healthy_count INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    critical_count INTEGER DEFAULT 0,
    down_count INTEGER DEFAULT 0,
    manual_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'in_progress' NOT NULL, -- 'in_progress', 'completed', 'failed'
    error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_monitoring_runs_started ON monitoring_runs(started_at DESC);
