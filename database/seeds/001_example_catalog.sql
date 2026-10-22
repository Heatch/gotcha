-- Illustrative content only, not a production catalog or full-game capacity guarantee.
-- Deterministic fixture IDs, not credentials. Apply once after 001_initial.sql.
SET time_zone = '+00:00';
START TRANSACTION;

INSERT INTO mission_packs (id, kind, catalog_key, title, description)
VALUES (
    UNHEX('00000000000040008000000000000001'),
    'builtin',
    'example-social',
    'Example social pack',
    'Eight illustrative missions retained from the old example. Review content before launch.'
);

INSERT INTO missions (id, pack_id, position, mission_text, allows_group) VALUES
    (UNHEX('00000000000040008000000000000101'), UNHEX('00000000000040008000000000000001'), 1, 'Get someone to compliment your hair', FALSE),
    (UNHEX('00000000000040008000000000000102'), UNHEX('00000000000040008000000000000001'), 2, 'Get someone to dab', FALSE),
    (UNHEX('00000000000040008000000000000103'), UNHEX('00000000000040008000000000000001'), 3, 'Make someone say moist in a sentence', FALSE),
    (UNHEX('00000000000040008000000000000104'), UNHEX('00000000000040008000000000000001'), 4, 'Start a congo line (min 3 people)', TRUE),
    (UNHEX('00000000000040008000000000000105'), UNHEX('00000000000040008000000000000001'), 5, 'Get someone to tell you their star sign', FALSE),
    (UNHEX('00000000000040008000000000000106'), UNHEX('00000000000040008000000000000001'), 6, 'Get someone to sing Wheels on the Bus', TRUE),
    (UNHEX('00000000000040008000000000000107'), UNHEX('00000000000040008000000000000001'), 7, 'Get someone to whisper anything in your ear', FALSE),
    (UNHEX('00000000000040008000000000000108'), UNHEX('00000000000040008000000000000001'), 8, 'Get someone to beatbox for 5 seconds', FALSE);

COMMIT;
