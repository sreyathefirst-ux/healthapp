ALTER TABLE weekly_plans ADD COLUMN IF NOT EXISTS health_insights jsonb;
ALTER TABLE weekly_plans ADD COLUMN IF NOT EXISTS action_plan jsonb;
