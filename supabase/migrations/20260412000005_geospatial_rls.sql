-- PRP-03 Task 3.5: RLS policies and permissions for geospatial RPC functions
-- Read access: any authenticated user can query nearby/bbox alerts (public data)
-- Write access: existing RLS on sos_alerts already enforces owner-only writes

-- Revoke default public access, grant only to authenticated
REVOKE ALL ON FUNCTION nearby_alerts(double precision, double precision, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION nearby_alerts(double precision, double precision, double precision, integer) TO authenticated;

REVOKE ALL ON FUNCTION alerts_within_bbox(double precision, double precision, double precision, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION alerts_within_bbox(double precision, double precision, double precision, double precision, integer) TO authenticated;

REVOKE ALL ON FUNCTION snap_to_grid(double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION snap_to_grid(double precision, double precision, double precision) TO authenticated;
