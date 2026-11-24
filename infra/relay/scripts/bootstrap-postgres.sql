-- Run ONCE as the existing instance administrator, connected to postgres.
-- psql reads the password from its environment, never an argv or SQL literal in git.
\set ON_ERROR_STOP on
\getenv relay_password ATUM_CONNECT_DATABASE_PASSWORD
CREATE ROLE atum_connect LOGIN PASSWORD :'relay_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5;
CREATE DATABASE atum_connect OWNER atum_connect;
REVOKE ALL ON DATABASE atum_connect FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE atum_connect TO atum_connect;
\connect atum_connect
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO atum_connect;
ALTER ROLE atum_connect IN DATABASE atum_connect SET search_path = public;
ALTER ROLE atum_connect IN DATABASE atum_connect SET statement_timeout = '30s';
ALTER DEFAULT PRIVILEGES FOR ROLE atum_connect IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE atum_connect IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;
