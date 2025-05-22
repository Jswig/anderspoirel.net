---
title: "designing with dataclasses"
date: 2025-04-21T13:30:11-08:00
tags: ["python"]
draft: false
---

*Python [dictionaries](https://docs.python.org/3/tutorial/datastructures.html#dictionaries)
are core to the language, available without an import, and extremely flexible,
which means many Python programmers default to 
representing data as a `dict`. However,
[dataclasses](https://docs.python.org/3/library/dataclasses.html#module-dataclasses)
are often more appropriate. Here is why a ``dataclass`` can be the better choice, and
how to decide between the two.*

> **Note**: I used `dataclass` here since it is part the standard library. You might
> already be using a 3rd-party library for defining record-like classes,
> such as [attrs](https://www.attrs.org/en/stable/). The advice
> here still applies, just replace `dataclass` with whichever library you are using.

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
This makes it easy to define containers for a collection of related
attributes.

# Advantages of a `dataclass` over a `dict`

## Readability

A `dataclass` can be more readable than a `dict`
When you see a `dataclass` like `Order` above, you can know just by glancing at its
definition which fields it contains [^1]. On the other hand, with a `dict`, items
can be added or removed dynamically at various points in the code, so you have to
potentially read through much more code to understand the shape of the data.
While this can be avoided with discipline (for instance, not adding new items to a dict
after it is instantiated), dataclasses enforce this automatically.

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
	"item_id": "i1435",
	"amount" 10,
}
```
does not raise an error. If the `"customer_id"` is accessed somewhere downstream,
```py
customer = order["customer_id"]
```
raises `KeyError: 'customer_id'` and and you are left backtracking through the
code to find where you forgot to add `'customer_id'` originally.

`dataclass`es also work well with type checkers like
[mypy](https://mypy.readthedocs.io/en/stable/). Since they encourage annotating each
field with types, code using `dataclass`es can be type checked with very
little extra effort on the part of the user.

# Heuristics

Dataclasses are useful when the names of the fields/items in your data
container are known ahead of time. Here are some heuristics to help you decide if you 
should use a `dict` or a `dataclass`:

1. Are field/item names hardcoded (e.g. you have code that look like
  `order["item_id"]`)? Use a `dataclass`, which enforces the presence of these names
2. Do you need to loop over field/items names? Use a `dict`, which makes this iteration
  very easy (whereas the way of doing this with a `dataclass` is slightly obscure)

# Example

Let's see how these heuristics apply in a longer program.
This script uploads a directory of text files to object storage (here S3).
Each file's object key looks like this:
```
{id}/{start_timestamp}/{session_name}
```
and the necessary metadata to derive this key is stored on the first line of each file 
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
	return metadata_by_file


def _build_s3_keys(metadata_by_file):
	object_keys = {}
	for filepath, metadata in metadata_by_file.items():
		recorder = metadata["id"]  # (3)
		started_at = metadata["started_at"]
		session_name = metadata["session"]
		object_keys[filepath] = f"{recorder}/{session_name}_{started_at}"
	return object_keys


def _upload_to_s3(s3_bucket, s3_key_by_file):
	s3_client = boto3.client("s3")
	for filepath, s3_key in s3_key_by_file.items():
		s3_client.upload_file(filepath, s3_bucket, s3_key)
```

Using a `dict` for `recordings` in (1) is appropriate - we never hard-code a
key name.

However the `dict` in (2) fails the test: we hard-coded keys 
downstream in `_build_s3_keys()` (3).

Here is the same script after re-writing (2) to use a `dataclass`.

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

The improvement in readability is more obvious if you use type hints. In
the next code listing, the shape of the argument to `_build_s3_headers` is obvious
whereas in the version before that it required reading `_parse_headers`:

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
			session_name=metadata["session"],
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

# Exceptions

These heuristics are not hard rules, and in some cases it is best to ignore them.

One of these is when calling code from libraries that takes or returns a `dict`. This
is common when serializing or de-serializing data, like in the standard
library's [json](https://docs.python.org/3/library/json.html) module. 
If you are building the data in the same function where it is used, it is OK to just
use a dict, even if there are hard-coded keys.

Another good reason is performance. While accessing a `dataclass` attribute is only
slightly slower than accessing a key in a `dict`, instantiating a `dataclass` is ~5x
slower than creating a `dict` [^2]. So, if you are instantiating tens of thousands
of dataclasses and you have determined that this is a bottleneck, it is OK to use
a `dict` instead.

In both of these cases, in codebases that use a type checker like
[mypy](https://mypy.readthedocs.io/en/stable/), you can annotate your code with
[TypedDict](https://typing.python.org/en/latest/spec/typeddict.html#typeddict)s
to recover some readability and error checking capabilities.

[^1]: This is not a guarantee - Python is very flexible, and most object attributes
can be added or changed at any time. For instance, unless `slots=True` is
passed to `@dataclass`, you can assign attributes not defined in the original dataclass.
`slots=True` also makes the class more memory-efficient!

[^2]: https://stackoverflow.com/a/55256047