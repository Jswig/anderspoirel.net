---
title: "Spot check random samples of your data"
date: 2026-01-16T08:41:38-08:00
tags: []
draft: false
---

***Assumed audience:*** *data analysts/engineers/scientists.*

---

It's hard to get around the need to manually inspect *real* inputs and outputs when
working on a data pipeline. Unit tests with well-formed synthetic rows won't save you
if the actual source data look like this:

```text
| ticket_id | category    | source   | ...
|-----------+-------------+----------+----
|        32 | bug         | customer | ...
|         1 | BUG         | customer |
|        47 | feature     | internal |
|        16 | feat.       | internal |
```
In practice, this means I would end up issuing a lot of queries like this one to spot
check data:
```sql
select ticket_id, category, source, created_at
from support_tickets
where source = 'customer'
order by created_at desc
limit 100
```
However, this query will always return the sames rows — maybe the inconsistencies in
`category` are found  4,000 rather than 4 rows deep and will never show up in the
returned rows! It's tempting to assume that the most recent rows (or however else you
chose to restrict the results) are representive, but this assumption is often wrong when
confronted with the messiness of real systems.

Perhaps the source system added extra validation for the `category` a month ago, but it
wasn't deemed necessary to update historical records to match. Or internal tickets go
through a different subsystem that doesn't have as many guardrails as customer tickets.
Or ... you get the idea.

On the other hand, inspecting more than a few hundred rows is impractical, especially if
the table is wide.

A better approach is to randomly sample from your data[^1]:
```sql
select ticket id, category, source, created_at
from support_tickets tablesample reservoir(100 rows)
```
This will give you a much higher chance of finding problems, since you're not
arbitrarily biasing the data subset you're inspecting.

Of course, random sampling won't uncover everything, but in my experience it's very
effective at surfacing issues I wouldn't otherwise discover during development. In
practice, this looks like alternating between taking random samples to discover new
problematic rows, and building a follow-up query to discover variations of this problem
and help me iterate on my pipeline's logic.

[^1]: The query shown here uses DuckDB syntax for random sampling, but most SQL dialects
([Snowflake](https://docs.snowflake.com/en/sql-reference/constructs/sample),
[Apache Spark](https://spark.apache.org/docs/latest/sql-ref-syntax-qry-select-sampling.html)
[Postgres](https://www.postgresql.org/docs/current/sql-select.html))
support a similar statement. Annoyingly, none of this is standardized in ANSI SQL.
