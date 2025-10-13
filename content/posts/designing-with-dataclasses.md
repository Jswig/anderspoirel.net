---
title: "Designing with dataclasses"
date: 2025-04-21T13:30:11-08:00
tags: ["python"]
draft: false
---

> **Assumed audience:** Python programmers who aren't in the habit of writing classes

*Python [dictionaries](https://docs.python.org/3/tutorial/datastructures.html#dictionaries)
are available without an import and extremely flexible,
which means many Python programmers default to
representing data as a `dict`. Here's why and when you should use
[dataclasses](https://docs.python.org/3/library/dataclasses.html#module-dataclasses)
instead.*

> **Note**: I'm using `dataclass` here since it's in the standard library.
> If you're already using a similar 3rd-party library like the excellent
> [attrs](https://www.attrs.org/en/stable/) the advice here still applies, just replace
> uses of `dataclass` with that library.

## What is a dataclass?

If you're already familiar with dataclasses, skip ahead to the next section.

`dataclass` is a class [decorator](https://docs.python.org/3/glossary.html#term-decorator)
which automatically generates [special methods](https://docs.python.org/3/reference/datamodel.html#special-method-names)
like `__init__` and `__eq__`, making for more concise class definitions.
For instance, this class declaration:
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
can be replaced with:
```python
from dataclasses import dataclass

@dataclass
class Order:
	item_id: str
	customer_id: str
	amount: int

```

## Why use a `dataclass` instead a `dict`?

Data classes have a few distinct advantages over dictionaries.

### Readability

First, a `dataclass` can be more readable than a `dict`.
When you see a `dataclass` like `Order`, reading its
definition tells you which fields it contains [^1]. On the other hand, items
can be added or removed from a `dict` at various points in the code, which means
you have to  potentially read through much more code to know the shape of the data.
While this can be avoided with discipline (for instance, you can avoid inserting new
items into a `dict` after it's instantiated), `dataclass` helps enforce this discipline
automatically.

### Error checking & debugging

Representing data as a `dataclass` also makes debugging faster.
For example, using the same `Order` class as before, if you forgot to provide
`customer_id` when instantiating, it raises an error with the exact line where you
forgot to provide the `customer_id`:
```python
order = Order(item_id="i1435", amount=10)
```
```text
----> 1 Order(item_id="i2345", amount=10)

TypeError: Order.__init__() missing 1 required positional argument: 'customer_id'.
```
However, if we represented the same data as a `dict`, this would not raise an error:
```py
order = {
	"item_id": "i1435",
	"amount": 10,
}
```
If `"customer_id"` is accessed somewhere downstream,
```py
customer = order["customer_id"]
```
you get a `KeyError: 'customer_id'` and you're left backtracking through the
code to find where you forgot to add `'customer_id'`.

Dataclasses also work well with type checkers like
[mypy](https://mypy.readthedocs.io/en/stable/). Since they encourage annotating each
field with types, code using dataclasses can be type checked with very
little extra effort.

## When should you use a `dataclass` instead of a `dict`?

Leveraging dataclasses' strengths requires knowing the structure of your data ahead of
time. So, lean towards using a `dataclass` when your data has a fixed structure known
at design time and access fields by hardcoded names throughout the codebase.

On the other hand, you should still use a `dict` if you want to loop over the keys
and/or values (`dict`s provide several facilities that make this convenient),
especially if the values are of a homogeneous type (for instance, if all the values in
the `dict` are `float`s), or if you aren't accessing values by hardcoded names.

## Case study

Let's see how these heuristics apply in a larger program.

We have a function, `upload_directory`, which uploads a directory of text files to S3.
Each file's object key in S3 will be `{id}/{start_timestamp}/{session_name}`.
The data used for this key is stored on the first line of each file 
in this format:
```text
# id=53,started_at=2021-01-02T11:30:00Z,session_name=daring_foolion
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
	headers = {} # (1)
	for file_name in os.listdir(directory):
		file_path = os.path.join(directory, file_name)
		with open(file_path, "r") as f:
			headers[file_path] = f.readline()
	return headers


def _parse_headers(headers):
	metadata_by_file = {}
	for file_path, header in headers.items(): # (2)
		header = header.removeprefix("# ")
		pairs = header.split(",")s
		metadata = {} # (3)
		for key_value in pairs:
			key, value = key_value.split("=")
			metadata[key] = value
		metadata_by_file[file_path] = metadata
	return metadata_by_file


def _build_s3_keys(metadata_by_file):
	object_keys = {}
	for filepath, metadata in metadata_by_file.items():
		recorder = metadata["id"]  # (3)
		started_at = metadata["started_at"]
		session_name = metadata["session_name"]
		object_keys[filepath] = f"{recorder}/{session_name}_{started_at}"
	return object_keys


def _upload_to_s3(s3_bucket, s3_key_by_file):
	s3_client = boto3.client("s3")
	for filepath, s3_key in s3_key_by_file.items():
		s3_client.upload_file(filepath, s3_bucket, s3_key)
```

The use of a `dict` for `headers` in (1) is appropriate: we don't access or set any of
its items through hard-coded key names, and we loop over all the headers downstream in
`parse_headers()` (2). However, the `dict` in (3) fails our heuristics: we access
items through hard-coded key names downstream in `_build_s3_keys()` (4).

Here's the same script after re-writing (3) to use a `dataclass`:

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
		metadata = {}
		for key_value in pairs:
			key, value = key_value.split("=")
			metadata[key] = value
		metadata_by_file[file_path] = RecordingMetadata(
			recorder_id=metadata["id"],
			started_at=metadata["started_at"],
			session_name=metadata["session_name"],
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

The readability benefits are more obvious with type hints:

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


def _parse_headers(headers: dict[str, str]) -> dict[str, RecordingMetadata]:
	metadata_by_file = {}
	for file_path, header in headers.items():
		header = header.removeprefix("# ")
		pairs = header.split(",")
		metadata = {}
		for key_value in pairs:
			key, value = key_value.split("=")
			metadata[key] = value
		metadata_by_file[file_path] = RecordingMetadata(
			recorder_id=metadata["id"],
			started_at=metadata["started_at"],
			session_name=metadata["session_name"],
		)
	return metadata_by_file


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

## When should you break these rules?

As always, there are cases where it's OK to break the rules a little.

One of them is calling functions that takes a `dict` as a parameter, or returns one. This
is common when serializing or de-serializing data, like in the standard
library's [json](https://docs.python.org/3/library/json.html) module.
If you're building the data in the same function where it's used, it's OK to just
use a `dict`, even if there are hard-coded keys.

Another one is performance. While accessing a `dataclass` attribute is only
slightly slower than accessing a key in a `dict`, instantiating a `dataclass` is ~5x
slower than creating a `dict` [^2]. So, if you're instantiating tens of thousands
of dataclasses and you've determined it's a bottleneck, you can use
dicts instead.

In both cases, if you're using a type checker, you can annotate your code with
[TypedDict](https://typing.python.org/en/latest/spec/typeddict.html#typeddict)s
to regain some readability and error checking.

[^1]: This is not a guarantee - Python is very flexible, and most object attributes
can be added or changed at any time. For instance, unless `slots=True` is
passed to `@dataclass`, you can assign attributes not defined in the original dataclass.
`slots=True` also makes the class more memory-efficient!

[^2]: https://stackoverflow.com/a/55256047