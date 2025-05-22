---
title: "getting column names from Python DBAPI query results"
date: 2025-01-05T14:58:10-08:00
tags: ["python"]
draft: false
---

[PEP-249 - Python Database API Specification](https://peps.python.org/pep-0249/)
(DBAPI) defines a standard interface for database access in Python that's implemented 
by libraries such as [psycopg](https://www.psycopg.org/docs/) and
[PyMySQL](https://pymysql.readthedocs.io/en/latest/). 

One common task with DBAPI libraries I see new users bounce off is identifying
column names in query results, since 
[fetching](https://peps.python.org/pep-0249/#cursor-methods) from a `Cursor` only 
returns a sequence of list-like rows. For instance, in the following query,
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
In a simple case like this one, going from (1) to (2) using hardcoded column
names is not too cumbersome:
```py
rows = [{"user_id": r[0], "created_at": r[1]} for r in result]
```
However, this quickly becomes impractical when our query includes dozens of columns or
even a `SELECT *`[^1].

Thankfully, there is an easy way of retrieving column names automatically that does not 
involve reaching for [SQLAlchemy](https://www.sqlalchemy.org/)[^2]

Cursors have a `description` attribute, which is a sequence of column desciptions for
the result of the last query executed. The first element of each column description is
the column's name, so we can get all the column names like this:
```py
column_names = [c[0] for c in cursor.description]
```

Putting everything together, given a connection and a query, we can run the
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

[^1]: before you balk that it should not be used in practice, `SELECT *` is very, very
convenient for data exploration

[^2]: `SQLAlchemy` is a great fit for many workloads, especially if you limit
yourself to the [core](https://docs.sqlalchemy.org/en/20/core/) API! But it is also
a large dependency with a bit of a 
[learning curve](https://lucumr.pocoo.org/2011/7/19/sqlachemy-and-you/), which I prefer
to avoid introducing in applications that don't otherwise make use of its features
