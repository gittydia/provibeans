import "./env.mjs";
import { raw } from "./pg.mjs";

const users = await raw(
  "select id, email, name, role, is_active, created_at from users order by id",
);

console.log("Every account that currently exists:");
console.log("-------------------------------------------");
for (const user of users) {
  console.log(`  ${user.id}. ${user.email}`);
  console.log(`      name:  ${user.name}`);
  console.log(`      role:  ${user.role}`);
  console.log(`      active:${user.is_active ? " yes" : " no"}`);
  console.log(`      made:  ${user.created_at}`);
}

const rows = await raw("select count(*)::int as n from users");
console.log("-------------------------------------------");
console.log(`Total: ${rows[0].n} accounts, all created by the seed script.`);