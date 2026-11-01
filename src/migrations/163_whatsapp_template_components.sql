-- WA-001 Stage B governed template components and provider-ready examples.
-- This migration adds no provider submission or message dispatch capability.

ALTER TABLE wa_message_template_versions
  ADD COLUMN header_type TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN header_material_id UUID REFERENCES wa_material_catalogue(id),
  ADD COLUMN variable_samples JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN buttons JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE wa_message_template_versions
SET header_type='text'
WHERE header_text IS NOT NULL AND BTRIM(header_text)<>'';

UPDATE wa_message_template_versions
SET header_text=NULL
WHERE header_text IS NOT NULL AND BTRIM(header_text)='';

ALTER TABLE wa_message_template_versions
  ADD CONSTRAINT wa_message_template_versions_header_type_check
    CHECK(header_type IN ('none','text','image','video','document')),
  ADD CONSTRAINT wa_message_template_versions_header_content_check
    CHECK(
      (header_type='none' AND header_text IS NULL AND header_material_id IS NULL)
      OR (header_type='text' AND header_text IS NOT NULL AND header_material_id IS NULL)
      OR (header_type IN ('image','video','document') AND header_text IS NULL AND header_material_id IS NOT NULL)
    ),
  ADD CONSTRAINT wa_message_template_versions_variable_samples_object_check
    CHECK(jsonb_typeof(variable_samples)='object'),
  ADD CONSTRAINT wa_message_template_versions_buttons_array_check
    CHECK(jsonb_typeof(buttons)='array');

ALTER TABLE wa_material_catalogue
  DROP CONSTRAINT wa_material_catalogue_material_type_check;
ALTER TABLE wa_material_catalogue
  ADD CONSTRAINT wa_material_catalogue_material_type_check
    CHECK(material_type IN ('brochure','floor_plan','price_list','presentation','image','video','document','other'));

CREATE INDEX wa_message_template_versions_header_material_idx
  ON wa_message_template_versions(header_material_id)
  WHERE header_material_id IS NOT NULL;

GRANT SELECT,INSERT,UPDATE ON wa_message_template_versions,wa_material_catalogue
  TO nysareal_nysar2app;
