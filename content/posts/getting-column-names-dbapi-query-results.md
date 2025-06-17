---
title: "Getting column names from Python DBAPI query results"
date: 2025-01-05T14:58:10-08:00
tags: ["python"]
draft: false
---

[PEP-249](https://peps.python.org/pep-0249/)
("Python Database API Specification" a.k.a. "DBAPI") defines a standard interface
for database access in Python, implemented
by libraries such as [psycopg](https://www.psycopg.org/docs/) and
[PyMySQL](https://pymysql.readthedocs.io/en/latest/).

One common task with DBAPI libraries that is not immediately obvious is identifying
column names in query results, since
[fetching](https://peps.python.org/pep-0249/#cursor-methods) from a `Cursor` 
returns a sequence of list-like rows. For instance, in this query,
```python
# assume a 'users' table like this one:
# user_id | created_at
# --------+--------------------
#       1 | 2025-01-02 11:30:00
#       2 | 2025-01-03 10:00:00
cursor = connection.cursor()
cursor.execute("SELECT user_id, created_at FROM users")
result = cursor.fetchall()
```
`result` is
```python
[
    [1, datetime.datetime(2025, 1, 2, 11, 30, 0)]
    [2, datetime.datetime(2025, 1, 3, 10, 0, 0)]
] # (1)
```
but often the code downstream would prefer to handle a data structure where the column
names are explicitely identified, such as:
```python
[
    {"user_id": 1, "created_at": datetime.datetime(2025, 1, 2, 11, 30, 0)},
    {"user_id": 2, "created_at": datetime.datetime(2025, 1, 3, 10, 0, 0)},
] # (2)
```
In a simple case like this, going from (1) to (2) using hardcoded column
names is not too cumbersome:
```py
rows = [{"user_id": r[0], "created_at": r[1]} for r in result]
```
However, this becomes impractical once your query includes dozens of columns or
even a `SELECT *`[^1].

Using `Cursor`'s `description`, you can retreive column names automatically without
reaching for [SQLAlchemy](https://www.sqlalchemy.org/)[^2]. `description` is a sequence
of column desciptions for the result of the last query executed.
Since first element of each column description is the column's name, you can get all 
the column names like this:
```py
column_names = [c[0] for c in cursor.description]
```

Putting everything together, given a connection and a query, you can run the
query and unpack its result into the same format as (2):
```python
def execute_query(connection, query):
    cursor = connection.cursor()
    try:
        cursor.execute(query)
        result = cursor.fetchall()
        column_names = [c[0] for c in cursor.description]
    finally:
        cursor.close()
    return [
        {name: value for name, value in zip(column_names, row)}
        for row in result
    ]
```

[^1]: Before you balk that it should not be used in practice, `SELECT *` is very, very
convenient for data exploration.

[^2]: `SQLAlchemy` is a great fit for many workloads, especially if you limit
yourself to the [core](https://docs.sqlalchemy.org/en/20/core/) API! But it is also
a large dependency with a bit of a 
[learning curve](https://lucumr.pocoo.org/2011/7/19/sqlachemy-and-you/), which I would
rather avoid introducing in applications that do not otherwise make use of its features.
