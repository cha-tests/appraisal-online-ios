-- Item #6 from the synthetic user report: consumers whose property doesn't
-- fit the standard picture — agricultural/farmland, mixed commercial-
-- residential, undivided/co-owned inheritance, disaster-damaged, pre-
-- selling/not-yet-built — currently have no way to say so except forcing
-- Property Type to "Others" (which only captures a type name, not a
-- situation). A single free-text field, surfaced in the AI prompt and the
-- report, resolves most of that friction without a schema rebuild.
ALTER TABLE properties
  ADD COLUMN special_situation TEXT;
