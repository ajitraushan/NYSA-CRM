ALTER TABLE proposals ADD COLUMN proposal_number TEXT;

WITH numbered AS (
  SELECT
    id,
    TO_CHAR(created_at AT TIME ZONE 'Asia/Dubai','YYYYMM') AS period_code,
    ROW_NUMBER() OVER (
      PARTITION BY TO_CHAR(created_at AT TIME ZONE 'Asia/Dubai','YYYYMM')
      ORDER BY created_at,id
    ) AS sequence_number
  FROM proposals
)
UPDATE proposals p
SET proposal_number='NYSA-PR-'||n.period_code||'-'||LPAD(n.sequence_number::text,6,'0')
FROM numbered n
WHERE n.id=p.id;

ALTER TABLE proposals ALTER COLUMN proposal_number SET NOT NULL;
ALTER TABLE proposals ADD CONSTRAINT proposals_proposal_number_format_ck
  CHECK (proposal_number ~ '^NYSA-PR-[0-9]{6}-[0-9]{6}$');
CREATE UNIQUE INDEX proposals_proposal_number_uq ON proposals(proposal_number);

CREATE TABLE proposal_number_counters (
  period_code TEXT PRIMARY KEY CHECK (period_code ~ '^[0-9]{6}$'),
  last_value INTEGER NOT NULL CHECK (last_value>0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO proposal_number_counters(period_code,last_value)
SELECT split_part(proposal_number,'-',3),MAX(split_part(proposal_number,'-',4)::integer)
FROM proposals
GROUP BY split_part(proposal_number,'-',3);
