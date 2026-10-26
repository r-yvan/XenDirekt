-- Runs once when the docker-compose PostgreSQL volume is first created.
-- The test database name must end in _test (the test harness refuses anything else).
CREATE DATABASE xendirekt_test TEMPLATE template0 LOCALE_PROVIDER builtin BUILTIN_LOCALE 'C.UTF-8' ENCODING 'UTF8' OWNER xendirekt;
