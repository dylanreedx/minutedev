import { createAccessControl } from "better-auth/plugins/access";

const statement = {
  project: ["create", "read", "update", "delete", "assign", "comment"],
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
  project: ["create", "read", "update", "delete", "assign", "comment"],
});

export const admin = ac.newRole({
  project: ["create", "read", "update", "assign", "comment"],
});

export const member = ac.newRole({
  project: ["read", "assign", "comment"],
});



