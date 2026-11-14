-- Item #9 from the synthetic user report: foreclosure/distressed-property
-- specialists, mortgage lenders, and OFW-specialist brokers all said they
-- weren't sure the generic consumer lead pool fit their specific buyer
-- profile. Decided path (confirmed with the product owner): lightweight
-- tagging, not full segmentation or routing changes — a tag is just a
-- visible signal on a lead, nothing about which broker receives it.
--
-- help_tags is captured at broker opt-in (broker-optins.tsx, optional,
-- multi-select) and copied onto the lead it produces — kept on both tables
-- for the same reason is_owner/intends_to_sell/title_url already are
-- (017_property_title_and_ownership.sql): reports is the consumer-facing
-- record of what was asked and answered, leads is the broker-facing record
-- that actually needs to show it.
ALTER TABLE reports ADD COLUMN help_tags TEXT[];
ALTER TABLE leads ADD COLUMN lead_tags TEXT[];
