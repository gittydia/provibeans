import Database from "better-sqlite3";

const db = new Database("./data/provi-beans.db", { readonly: true });

const users = db
  .prepare(
    "select id, email, name, role, is_active, created_at from users order by id",
  )
  .all();

console.log("Every account that currently exists:");
console.log("-------------------------------------------");
for (const user of users) {
  console.log(`  ${user.id}. ${user.email}`);
  console.log(`      name:  ${user.name}`);
  console.log(`      role:  ${user.role}`);
  console.log(`      active:${user.is_active ? " yes" : " no"}`);
  console.log(`      made:  ${user.created_at}`);
}

const count = db.prepare("select count(*) n from users").get().n;
console.log("-------------------------------------------");
console.log(`Total: ${count} accounts, all created by the seed script.`);