DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'p5_api') THEN
    CREATE ROLE p5_api WITH LOGIN PASSWORD 'faseehvohra';
  ELSE
    ALTER USER p5_api WITH PASSWORD 'faseehvohra';
  END IF;
END \$\$;

DO \$\$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'p5_api') THEN
    CREATE DATABASE p5_api OWNER p5_api;
  END IF;
END \$\$;

GRANT ALL PRIVILEGES ON DATABASE p5_api TO p5_api;