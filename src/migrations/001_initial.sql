CREATE TABLE brokers (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  brokerage TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin','internal_broker','partner_broker','viewer')),
  can_post SMALLINT NOT NULL DEFAULT 1 CHECK (can_post IN (0,1)),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  password_hash TEXT NOT NULL,
  invited_by UUID REFERENCES brokers(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX brokers_email_lower_uq ON brokers (LOWER(email));

CREATE TABLE invitations (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  issued_by UUID NOT NULL REFERENCES brokers(id),
  issued_to_email TEXT,
  role TEXT NOT NULL DEFAULT 'internal_broker' CHECK (role IN ('admin','internal_broker','partner_broker','viewer')),
  max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  used_count INTEGER NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE listings (
  id UUID PRIMARY KEY,
  project TEXT NOT NULL,
  developer TEXT,
  area TEXT NOT NULL,
  property_type TEXT NOT NULL CHECK (property_type IN ('Apartment','Villa','Townhouse','Penthouse','Duplex','Plot','Bulk deal')),
  bedrooms TEXT CHECK (bedrooms IN ('Studio','1','2','3','4','5+')),
  size_sqft NUMERIC(14,2) CHECK (size_sqft IS NULL OR size_sqft >= 0),
  price NUMERIC(16,2) NOT NULL CHECK (price > 0),
  reference_price NUMERIC(16,2) CHECK (reference_price IS NULL OR reference_price >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'AED' CHECK (currency = UPPER(currency)),
  payment_plan_type TEXT CHECK (payment_plan_type IN ('Cash','Mortgage','Developer plan','Post-handover')),
  down_payment_percent NUMERIC(5,2) CHECK (down_payment_percent BETWEEN 0 AND 100),
  on_handover_percent NUMERIC(5,2) CHECK (on_handover_percent BETWEEN 0 AND 100),
  post_handover_years NUMERIC(5,2) CHECK (post_handover_years IS NULL OR post_handover_years >= 0),
  payment_plan_notes TEXT,
  handover_date TEXT,
  status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available','Reserved','Under offer','Closed')),
  closed_reason TEXT CHECK (closed_reason IN ('Sold','Withdrawn','Expired')),
  closed_at TIMESTAMPTZ,
  exclusivity_tier TEXT NOT NULL DEFAULT 'Off-market' CHECK (exclusivity_tier IN ('Exclusive to Nysa','Shared network','Off-market')),
  posted_by UUID NOT NULL REFERENCES brokers(id),
  contact TEXT,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX listings_area_idx ON listings(area);
CREATE INDEX listings_status_idx ON listings(status);
CREATE INDEX listings_price_idx ON listings(price);
CREATE INDEX listings_created_at_idx ON listings(created_at DESC);

CREATE TABLE comments (
  id UUID PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES listings(id),
  author_id UUID NOT NULL REFERENCES brokers(id),
  body TEXT NOT NULL,
  parent_comment_id UUID REFERENCES comments(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);
CREATE INDEX comments_listing_idx ON comments(listing_id);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('Listing','Comment','Broker','Invitation')),
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  performed_by UUID NOT NULL REFERENCES brokers(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details TEXT
);
CREATE INDEX audit_log_timestamp_idx ON audit_log(timestamp DESC);

CREATE TABLE sessions (
  token CHAR(64) PRIMARY KEY,
  broker_id UUID NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX sessions_broker_idx ON sessions(broker_id);
CREATE INDEX sessions_expires_idx ON sessions(expires_at);
