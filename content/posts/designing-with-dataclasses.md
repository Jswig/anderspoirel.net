---
title: "designing with dataclasses"
date: 2025-04-21T13:30:11-08:00
tags: []
draft: false
---

*Python [dictionaries](https://docs.python.org/3/tutorial/datastructures.html#dictionaries)
(henceforth referred to as `dict`) are core to the language, available without an
import, and extremely flexible, which means many Python programmers default to 
representing data as a `dict`. However,
[dataclasses](https://docs.python.org/3/library/dataclasses.html#module-dataclasses)
are often more appropriate. Here is why a ``dataclass`` can be the better choice, and
how to decide between the two.*

> **Note 1**: I use `dataclass` here since it is part the standard library. You might
> already be using a 3rd-party libraries for defining "data container" classes,
> such as the excellent [attrs](https://www.attrs.org/en/stable/). The patterns discussed
> here still apply, just replace `dataclass` with whichever library you are using.

> **Note 2**: If you are coming from a statically typed language such as Java, Go
> or Scala, the advice here might feel obvious to you, since these languages' type
> systems make ``dict``-like collections less natural to use as containers for
> heterogeneous data. Ditto if you are the kind of person who thinks in terms of
> [algebraic data types](https://en.wikipedia.org/wiki/Algebraic_data_type).


# What is a `dataclass`?

If you are already familiar with `dataclass` , feel free to skip this section.

`dataclass` is a class [decorator](https://docs.python.org/3/glossary.html#term-decorator)
that generates common methods such as
`__init__` and `__eq__`, making for more concise class definitions. 
For instance, this class declaration
```python
class Order:
	def __init__(self, item_id: str, customer_id: str, amount: int):
		self.item_id = item_id
		self.customer_id = customer_id
		self.amount = amount

	def __eq__(self, other):
		return (
			self.item_id == other.item_id
			and self.customer_id == other.customer_id 
			and self.amount == other.amount
		)


```
can be replaced with the following:
```python
from dataclasses import dataclass

@dataclass
class Order:
	item_id: str
	customer_id: str
	amount: int

```
This makes it relatively painless to define containers for a collection of related
attributes.

# Advantages of a `dataclass` over a `dict`

## Readability

A `dataclass` can be more readable than a `dict`
When you see a `dataclass`, you know almost for sure which data it contains [^1].

## Error checking & debugging

Representing data as a `dataclass` can make debugging a lot faster.
For instance, if you forget to provide `customer_id` when creating an `Order`,
```python
order = Order(item_id="i1435", amount=10)
```
it raises
```text
----> 1 Order(item_id="i2345", amount=10)

TypeError: Order.__init__() missing 1 required positional argument: 'customer_id'.
```
with the exact line where you forgot to provide the `customer_id`. 
By contrast, representing the same data as a `dict`,
```py
order = {
	"item_id": "i1435"
	"amount" 10
}
```
does not raise an error. If the `"customer_id"` is accessed somewhere downstream,
```py
customer = order["customer_id"]
```
raises `KeyError: 'customer_id'` and am you are left backtracking through the
code to find where you forgot to add `'customer_id'` originally.

`dataclass`es also work well with type checkers like
[mypy](https://mypy.readthedocs.io/en/stable/). Since they encourage annotating each
field with types, code using `dataclass`es can be type checked with very
little extra effort on the part of the user, which makes using [^2].

# Heuristics

Both of these benefits only apply when you know ahead of time the members of our data 
containers. 
Here are some heuristics you can use to decide whether to represent data as a
 `dict` or a `dataclass`:
- are member names hardcoded somewhere -> `dataclass`
	- this means you're expecting an exact name to be present
- Do fields have different types? -> `dataclass`
- Do you loop over the fields without ever calling a field by name -> `dict`

# Example

Let's see how these heuristics apply in a longer code listing. Consider
the following code that uploads a directory of files to cloud storage (here S3),
assigning each file in cloud storage a key derived from recording metadata stored
in the first line of each recording file under the following format:

```text
# id=53,started_at=2021-01-02T11:30:00Z,session_name=daring foolion
```

```python
import os

import boto3


def upload_directory(directory, s3_bucket):
	headers_by_file = _get_headers(directory)
	metadata_by_file = _parse_headers(headers_by_file)
	s3_key_by_file = _build_s3_keys(metadata_by_file)
	_upload_to_s3(s3_bucket, s3_key_by_file)


def _get_headers(directory):
	headers = {}
	for file_name in os.listdir(directory):
		file_path = os.path.join(directory, file_name)
		with open(file_path, "r") as f:
			headers[file_path] = f.readline()
	return headers


def _parse_headers(headers):
	metadata_by_file = {}
	for file_path, header in headers.items():
		header = header.removeprefix("# ")
		pairs = header.split(",")
		metadata = {} # (2)
		for key_value in pairs:
			key, value = key_value.split("=")
			metadata[key] = value
		metadata_by_file[file_path] = metadata
	return metadata


def _build_s3_keys(metadata_by_file):
	object_keys = {}
	for filepath, metadata in metadata_by_file.items():
		recorder = metadata["id"]
		started_at = metadata["started_at"]
		session_name = metadata["session"]
		object_keys[filepath] = f"{recorder}/{session_name}_{started_at}"
	return object_keys


def _upload_to_s3(s3_bucket, s3_key_by_file):
	s3_client = boto3.client("s3")
	for filepath, s3_key in s3_key_by_file.items():
		s3_client.upload_file(filepath, s3_bucket, s3_key)
```

Let's see how the code above fares under our heuristics.

The use of a `dict` for `recordings` in (1) is appropriate - we never hard-code a
specific key, and all the elements in this `dict` are of the same type.

The `dict` in (2) however, fails the test since we refer to keys in the dictionary
through hard-coded names.

Here is what this code looks like after re-writing (2) to use a `dataclass` [^3].

```python
import os
from dataclasses import dataclass

import boto3


def upload_directory(directory, s3_bucket):
	headers_by_file = _get_headers(directory)
	metadata_by_file = _parse_headers(headers_by_file)
	s3_key_by_file = _build_s3_keys(metadata_by_file)
	_upload_to_s3(s3_bucket, s3_key_by_file)


def _get_headers(directory):
	headers = {}
	for file_name in os.listdir(directory):
		file_path = os.path.join(directory, file_name)
		with open(file_path, "r") as f:
			headers[file_path] = f.readline()
	return headers


@dataclass
class RecordingMetadata:
	recorder_id: int
	started_at: str
	session_name: str


def _parse_headers(headers_by_file):
	metadata_by_file = {}
	for file_path, header in headers_by_file.items():
		header = header.removeprefix("# ")
		pairs = header.split(",")
		metadata = {} # (2)
		for key_value in pairs:
			key, value = key_value.split("=")
			metadata[key] = value
		metadata_by_file[file_path] = RecordingMetadata(
			recorder_id=metadata["id"],
			started_at=metadata["started_at"],
			session_name=metadata["session"],
		)
	return metadata_by_file


def _build_s3_keys(metadata_by_file):
	object_keys = {}
	for filepath, metadata in metadata_by_file.items():
		object_keys[filepath] = (
			f"{metadata.recorder_id}/{metadata.session_name}_{metadata.started_at}"
		)
	return object_keys


def _upload_to_s3(s3_bucket, s3_key_by_file):
	s3_client = boto3.client("s3")
	for filepath, s3_key in s3_key_by_file.items():
		s3_client.upload_file(filepath, s3_bucket, s3_key)
```



```python
def upload_directory(directory: os.PathLike, s3_bucket: str):
	headers_by_file = _get_headers(directory)
	metadata_by_file = _parse_headers(headers_by_file)
	s3_key_by_file = _build_s3_keys(metadata_by_file)
	_upload_to_s3(s3_bucket, s3_key_by_file)


@dataclass
class RecordingMetadata:
	recorder_id: int
	started_at: str
	session_name: str


def _get_headers(directory: os.PathLike) -> dict[str, str]:
	headers = {}
	for file_name in os.listdir(directory):
		file_path = os.path.join(directory, file_name)
		with open(file_path, "r") as f:
			headers[file_path] = f.readline()
	return headers


def _parse_headers(headers: str) -> dict[str, RecordingMetadata]:
	metadata = {}
	for file_path, header in headers.items():
		header = header.removeprefix("# ")
		pairs = header.split(",")
		metadata = {} # (2)
		for key_value in pairs:
			key, value = key_value.split("=")
			metadata[key] = value
		metadata[file_path] = RecordingMetadata(
			recorder_id=metadata["id"],
			started_at=metadata["started_at"],
			session_name=metadata["session"],
		)
	return metadata


def _build_s3_keys(metadata_by_file: dict[str, RecordingMetadata]) -> dict[str, str]:
	object_keys = {}
	for filepath, metadata in metadata_by_file.items():
		object_keys[filepath] = (
			f"{metadata.recorder_id}/{metadata.session_name}_{metadata.started_at}"
		)
	return object_keys


def _upload_to_s3(s3_bucket: str, s3_key_by_file: dict[str, str]):
	s3_client = boto3.client("s3")
	for filepath, s3_key in s3_key_by_file.items():
		s3_client.upload_file(filepath, s3_bucket, s3_key)
```

# Exceptions to these heuristics

Near serialization/deserialization code: a lot of libraries take or produce `dict` s at
their API boundaries, and it may be simpler to just construct the dict directly if the
`dict` is used directly there without being passed to another function. (once the data
 is passed to another functions scopes however, I recommmend making
it a `dataclass`)

Performance. While accessing a `dataclass`'s attribute is only slightly slower than
than accessing a key in a `dict`, instantiating a `dataclass` is at least 5x slower
than creating a `dict`, so if you are instantiating 1000s of these and you have 
determined that this is a bottleneck, prefer a `dict`

In both of these cases, in codebases that use type checking through for instance
[mypy](https://mypy.readthedocs.io/en/stable/), a 
[TypedDict](https://typing.python.org/en/latest/spec/typeddict.html#typeddict)
can be used instead of the `dataclass` to recover some of the readability and safety
benefits of the latter.

[^1]: This is not a guarantee - Python is very flexible, and most things can be
overriden downstream of an object being defined. For instance, unless `slots=True` is
passed to `@dataclass`, you can assign attributes not defined in the original dataclass.

[^2]: [TypedDict](https://typing.python.org/en/latest/spec/typeddict.html) can get you
most of the same type checking benefits

[^3]: The example here was kept short in the interest of  readability. In a real
codebase, the code here is short enough that I would probably go in a different
direction and simplify by in-lining `_build_s3_keys()` into `_parse_headers()`, such
that the latter returns a mapping of file paths to S3 keys, which still avoids
passing a heterogeneous `dict` between scopes. 