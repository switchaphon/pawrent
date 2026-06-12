-- Role bootstrap for local validation. Production deployments rotate this password via secrets.
CREATE ROLE pawrent_app LOGIN PASSWORD 'pawrent_app_dev_password';
ALTER ROLE pawrent_app SET search_path = public;
