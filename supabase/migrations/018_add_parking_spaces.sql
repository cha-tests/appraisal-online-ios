-- "Parking Spaces" field on the property-details form, requested right
-- after Bathrooms. Optional (NULL means the consumer didn't answer, not
-- zero) — see property-details.tsx's parkingText comment.
ALTER TABLE properties
  ADD COLUMN parking_spaces INTEGER;
