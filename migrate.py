"""Run once to create new users/watches tables in the existing DB."""
import db
db.init_db()
print("Migration complete.")
