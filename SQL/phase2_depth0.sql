-- Phase 2 追補: 0段（代表者のみ・組織ユニットなし）
-- phase1_multi_tenant.sql および phase2_org_hierarchy.sql 実行後に実行してください。

alter table organizations drop constraint if exists organizations_org_structure_depth_check;

alter table organizations
  add constraint organizations_org_structure_depth_check
  check (org_structure_depth is null or org_structure_depth in (0, 1, 2, 3));
