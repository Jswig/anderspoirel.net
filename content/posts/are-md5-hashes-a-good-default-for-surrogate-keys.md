---
title: "Are MD5 hashes a good default for surrogate keys?"
date: 2026-05-16T20:36:23-07:00
tags: []
draft: false
favorite: true
---
***Assumed audience:** data and analytics engineers.*

In the extra-load-transform (ELT) paradigm of data engineering, a popular method to
generate surrogate keys in the transformation step is to compute a
[MD5 hash](https://en.wikipedia.org/wiki/MD5) of uniquely identifying columns and store
it as a string. This is the approach of dbt's built-in
[generate_surrogate_key](https://docs.getdbt.com/blog/sql-surrogate-keys?version=1.11)
macro.

The arguments for using a hash instead of an incrementing integer sequence are well worn
at this point. Hash keys are deterministic, idempotent, and work just as well on views
as on materialized tables. These properties are particularly important for the typical
workflow in the ELT paradigm, where views are common and tables downstream of the raw
data load are re-built on each run.

But what are we giving up by using a full MD5 hash stored as a string?

## Memory and performance considerations

MD5 hashes have 128 bits of entropy, but the MD5 function in most SQL dialects returns a
32-character hexadecimal string representation, which in practice often means ~32 bytes
in memory. Compare this to integer keys, which are typically 8 bytes.

Database join performance tends to be dominated by memory access[^1] [^2]. Larger keys
generally have worse cache locality and memory bandwidth characteristics. We would
thus expect a join using string MD5 hash keys to be noticeably slower than one using
64-bit integer keys.

So, ideally we would want a surrogate key generation method that is both idempotent and
fits in a 64-bit integer. Do major data warehouses have a reasonable way of
generating a deterministic 64-bit integer hash? Well, we can always truncate the MD5
32-character text to 16 characters and convert that a 64-bit integer[^3].

That's probably the best option unless you're in Snowflake which already has this in the
form of
[md5_number_upper64](https://docs.snowflake.com/en/sql-reference/functions/md5_number_upper64).

So, how much of a speedup can we expect from using a more efficient truncated MD5 key?

## Benchmark

The benchmark runs an aggregation on a fact table with 100 million rows, that joins to a
dimension table with 100 thousand rows. Not tiny; but not "big data" either. This is a
typical dataset at my day job. It runs the same query with both string MD5 hash keys,
and 64-bit integer truncated MD5 hash keys. I ran this in Snowflake on an XS warehouse.


| **Run** | **MD5 string** | **MD5 truncated to 64 bits** | **Speedup** |
|----------- | ------------ | --------------------------------- | ----------- |
| 1 | 323ms | 239ms | 26.0% |
| 2 | 334ms | 243ms | 27.2% |
| 3 | 343ms | 254ms | 25.9% |
| 4 | 568ms | 249ms | 56.2% |
| 5 | 331ms | 247ms | 25.4% |
| 6 | 355ms | 238ms | 33.0% |
| 7 | 341ms | 241ms | 29.3% |
| 8 | 335ms | 243ms | 27.5% |
| 9 | 336ms | 256ms | 23.8% |
| 10 | 366ms | 259ms | 29.2% |
| **Average** | **363.2ms** | **246.9ms** | **30.35%** |

That's a ~30% speedup. Of course, there is a lot variation between data warehouses in
how they implement join strategies, vectorization and compression, which will affect the
magnitude of the speedup. However, the broad strokes of modern "shared-nothing" data
warehouse systems are similar enough that I would expect the performance improvement to
remain noticeable across systems.

## Key collisions

A MD5 hash is 128 bits of entropy. Plugging this into a hash collision calculator, even
at 100 trillion rows in a table the collision chance is less than 1 in a billion, which
is to say that it "just works" for any practical dataset[^4].
A 64-bit truncated version on the other hand has a ~2.7% chance at 1,000,000,000 rows;
which means that collisions can't always be assumed away.

But many dimensions in a typical data warehouse will never get close to the size where
64-bit keys collide, even SCD 2 type ones – an employees table will probably never be
close to 100 million rows, and neither will your corporate offices or product SKUs
(unless you're amazon.com).

So you probably have dimensions with cardinalities that fit comfortably in a truncated
MD5 key without collision, and if you're building a star schema, end-user queries almost
certainly involve one or several joins on surrogate keys.
Spend the extra minute to check if the cardinality of your data allows for the more
efficient key type – with how often Databricks or Snowflake costs (pick your favorite
expensive data warehouse!) are a concern, it may be well worth your time. If 30% faster
queries let you downgrade a L size Snowflake warehouse for BI that's on 8 hours a day, 5
days a week to an M size, that's ~$20,000 per annum saved[^5].

[^1]: Shimin Chen, Anastassia Ailamaki, Phillip B. Gibbons, and Todd C. Mowry. 2007.
[Improving hash join performance through prefetching](https://www.pdl.cmu.edu/PDL-FTP/Database/icde04.pdf).
_ACM Transactions on Database Systems_ 32, 3 (August 2007), 17. DOI:
http://dx.doi.org/10.1145/1272743.1272747

[^2]: The linked paper discusses hash joins, the most common algorithm — modern data
warehouses typically use this in combination with other algorithms depending on the
query plan.

[^3]: Another possibility would be to store the MD5 hash in binary form instead of text,
which preserves the original 128 bits of entropy and represents a nice middle ground
in terms of size since it's only 16 bytes. However, I don't like it in practice
because many client systems in practice don't have as good support for binary type
columns.

[^4]: Hash collision calculators give probabilities derived from the
[Birthday Problem](https://kevingal.com/blog/collisions.html). The true collision
probability will depend on many factors like the hash function in use and the input
data, but the Birthday Problem is a useful first approximation if you're using a good
hash function.

[^5]: At Snowflake Standard Edition credit prices as of May 2026.
