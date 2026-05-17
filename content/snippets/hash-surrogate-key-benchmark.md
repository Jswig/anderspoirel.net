---
title: "Hash Surrogate Key Benchmark"
date: 2026-05-17T12:58:27-07:00
draft: false
---

This benchmark compares the join in Snowflake performance of surrogate keys generated
via `md5` versus surrogate keys generated via `md5_number_lower64`. Run this in a schema
you have write permissions on and on a dedicated warehouse to avoid interference with
the results.

```sql
create or replace transient table benchmark_dim as
select
    row_number() over (order by null) as natural_key
    , md5(natural_key::varchar) as sk_md5
    , md5_number_lower64(natural_key::varchar) as sk_int64
    , 'Attribute_' || natural_key as attr_1
    , current_date - mod(natural_key, 365) as attr_date
from table(generator(rowcount => 100000));

create or replace transient table benchmark_fact as
select
    row_number() over (order by null) as fact_id
    , mod(fact_id - 1, 100000) + 1 as dim_natural_key
    , md5(dim_natural_key::varchar) as fk_md5
    , md5_number_lower64(dim_natural_key::varchar) as fk_int64
    , uniform(1, 1000, random()) as measure_1
    , uniform(1::float, 100::float, random()) as measure_2
    , current_date - mod(fact_id, 730) as event_date
from table(generator(rowcount => 10000000));

create or replace transient table benchmark_results (
    run_id int
    , join_type varchar(20)
    , execution_time_ms int
    , compilation_time_ms int
    , bytes_scanned bigint
    , query_id varchar
    , ts timestamp_ntz default current_timestamp()
);

-- disable caching to avoid skewing results
alter session set use_cached_result = false;

create or replace procedure run_benchmark()
returns varchar
language sql
execute as caller
as
declare
    num_runs int := 10;
    run int;
    join_types array := ['md5', 'int64'];
    jt varchar;
    i int;
    qid varchar;
begin
    for run in 1 to num_runs do
        -- shuffle order each run by alternating start point
        for i in 0 to 1 do
            jt := join_types[mod(run + i, 2)];
 
            if (jt = 'md5') then
                select d.attr_1, sum(f.measure_1), avg(f.measure_2)
                from benchmark_fact f
                join benchmark_dim d on f.fk_md5 = d.sk_md5
                where f.event_date >= '2024-01-01'
                group by 1 order by 2 desc limit 100;
            else
                select d.attr_1, sum(f.measure_1), avg(f.measure_2)
                from benchmark_fact f
                join benchmark_dim d on f.fk_int64 = d.sk_int64
                where f.event_date >= '2024-01-01'
                group by 1 order by 2 desc limit 100;
            end if;

            qid := last_query_id();
 
            insert into benchmark_results (run_id, join_type, execution_time_ms, compilation_time_ms, bytes_scanned, query_id)
            select
                :run,
                :jt,
                execution_time,
                compilation_time,
                bytes_scanned,
                query_id
            from table(information_schema.query_history())
            where query_id = :qid;

        end for
    end for;
 
    return 'completed ' || num_runs || ' runs';
end;

call run_benchmark();

select * from benchmark_result order by run_id asc;
```
