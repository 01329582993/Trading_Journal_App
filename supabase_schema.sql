-- Create Trades Table
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT CHECK (type IN ('Profit', 'Loss')) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  pair TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Targets Table
CREATE TABLE targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_target DECIMAL(12, 2) DEFAULT 0,
  monthly_target DECIMAL(12, 2) DEFAULT 0,
  custom_target DECIMAL(12, 2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Prop Firm Settings Table
CREATE TABLE prop_firm (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_size DECIMAL(12, 2) NOT NULL,
  profit_target_pct DECIMAL(5, 2) NOT NULL,
  max_daily_loss_pct DECIMAL(5, 2) NOT NULL,
  max_drawdown_pct DECIMAL(5, 2) NOT NULL,
  min_trading_days INTEGER NOT NULL,
  phase TEXT,
  start_date DATE NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE ROW LEVEL SECURITY (RLS)
-- For a quick start, we allow public access. 
-- IN PRODUCTION: You should use auth.uid() to restrict data to users.
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_firm ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access" ON trades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access" ON targets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access" ON prop_firm FOR ALL USING (true) WITH CHECK (true);
