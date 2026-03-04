---
title: "Check your SQL session timezone"
date: 2026-02-15T16:11:07-08:00
tags: []
draft: false
---

I recently encountered two bugs with a similar flavor. In both, I had unit tests which
worked correctly in CI but failed when running on my machine.

Make sure your database timezone is set correctly w
```sql
set timezone to 'UTC'
```
In PySpark, the solution was:
```python
from pyspark.sql import SparkSession

spark = (
    SparkSession
    .builder
    .config("spark.sql.session.timeZone", "UTC")
    .getOrCreate()
)
```
(you might also prefer to set this via a global configuration file, like 
[spark.conf]())