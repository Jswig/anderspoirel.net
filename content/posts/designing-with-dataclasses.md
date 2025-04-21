---
title: "designing with dataclasses"
date: 2025-02-24T01:03:11-08:00
tags: []
draft: false
---


[Dictionaries](https://docs.python.org/3/tutorial/datastructures.html#dictionaries) are one of the first Python features new users learn about. Moreover, they are available without an import and very flexible, so many Python programmers end up using `dict`s for *everything*. 

But, `dict`s are not always the best approach for structuring your data. This post goes over why [dataclasses](https://docs.python.org/3/library/dataclasses.html#module-dataclasses) are sometimes more appropriate, and provides guidelines for picking between the two.

> Note 1: I use `dataclass` here since it is in the standard library. You might already be using one of the many excellent 3rd-party libraries for defining "data container" classes, such as [attrs](https://www.attrs.org/en/stable/). The patterns discussed here still apply, just replace `dataclass` with whichever library you are using.

> Note 2: If you are coming from a statically typed like Java, Go and Scala, or think in terms of [mapping types](https://en.wikipedia.org/wiki/Associative_array) and [product types](https://en.wikipedia.org/wiki/Associative_array) ... this article is not for you! The discussion here is probably obvious to you.

# Heuristics 

Here are some heuristics I apply to decide whether a piece of data should be stored as  `dict` or a `dataclass`:
- are member names hardcoded somewhere -> `dataclass`
	- this means you're expecting an exact name to be present
- Do fields have different types? -> `dataclass`
- - Do I loop over the fields without ever calling a field by name -> `dict`

# Example

Now, let's examine how these heuristics apply in a more concrete example. Consider the following code that uploads a directory of files to cloud storage (here S3), assigning each file in cloud storage a key derived from recording metadata stored in the first line of each recording file under the following format:
```
id=53,started_at=2021-01-02T11:30:00Z,session_name=daring foolion
```

```python
import os
import boto3


def upload_directory(directory, s3_bucket):
	recordings = _get_recordings_info(directory)
	upload_recordings(recordings, s3_bucket)


def _extract_metadata(directory):
	recordings = {} # (1)
	for file_name in os.lisdir(directory):
		file_path = os.path.join(directory, file_name)
		recordings(filepath) = _parse_header(file_path)
	return recordings


def _parse_header(filepath):
	with open(filepath, "r") as f:
		first_line = f.readline()
	first_line.removeprefix("#")
	pairs = first_line.split(",)
	metadata = {} # (2)
	for key_value in pairs
		key, value = key_value.split("=")
		metadata[key] = value
	return metadata


def _upload_to_s3(recordings, s3_bucket)
	s3_client = boto3.client("s3")
	for filepath, metadata in recordings.items():
		recorder = metadata["id"]
		started_at = metadata["started_at"]
		session_name = metadata["session"]
		object_key = f"{recorder}/{session}_{started_at}"
		s3.upload_file(filepath, s3_bucket, object_key)
```

Let's see how the code above fares under our heuristics.

The use of a `dict` for `recordings` in (1) is appropriate - we never hard-code a specific key, and all the elements in this `dict` are of the same type.

The `dict` in (2) however, fails test. We refer to keys in the dictionary through hard-coded names. 

```python
import os
from dataclasses import dataclass

import boto3

@dataclass
class RecordingMetadata:
	recorder_id: str
	started_at: str
	session_name: str
	

def upload_directory(directory, s3_bucket):
	recordings = _extract_metadata(directory)
	upload_recordings(recordings, s3_bucket)


def _extract_metadata(directory):
	recordings = {} # (1)
	for file_name in os.lisdir(directory):
		file_path = os.path.join(directory, file_name)
		recordings(filepath) = _parse_header(file_path)
	return recordings


def _parse_header(filepath):
	with open(filepath, "r") as f:
		first_line = f.readline()
	first_line.removeprefix("# ")
	pairs = first_line.split(",)
	metadata = {
		key: value for key, value in key_value.split("=")
		for key_value in pairs
	} 
	return RecordingMetadata(
		recorder_id=metadata["recorder_id"]
		started_at=metadata["started_at"]
		session_name=metadata["session_name"]
	)


def _upload_to_s3(recordings, s3_bucket)
	s3_client = boto3.client("s3")
	for filepath, metadata in recordings.items():
		object_key = f"{metadata.recorder_id}/{metadata_.session}_{metadata.started_at}"
		s3.upload_file(filepath, s3_bucket, object_key)
```

If we forgot to provide a piece of data in our code, we are alerted immediately in `_parse_header`, rather than further downstream. While this is not that impactful in a small code listing like this one, it helps a lot in larger codebase, where this lets us get to the source of the error right aways instead of going through dozens of function calls to figure out where data is missing.

Moreover, this boosts code readability, since readers will be able to tell at a glance which 
data `_upload_to_s3` expects in `recordings`, rather than have to read the entire body of the function. This benefit becomes clearer in codebases with type annotations:
```python
import os
from dataclasses import dataclass

import boto3

@dataclass
class RecordingMetadata:
	recorder_id: str
	started_at: str
	session_name: str
	

def upload_directory(directory: os.Pathlike, s3_bucket: str):
	recordings = _extract_metadata(directory)
	upload_recordings(recordings, s3_bucket)


def _extract_metadata(directory: os.Pathlike) -> dict[str, RecordingMetadata]:
	recordings = {} # (1)
	for file_name in os.lisdir(directory):
		file_path = os.path.join(directory, file_name)
		recordings(filepath) = _parse_header(file_path)
	return recordings


def _parse_header(filepath: os.Pathlike) -> RecordingMetadata:
	with open(filepath, "r") as f:
		first_line = f.readline()
	first_line.removeprefix("# ")
	pairs = first_line.split(",)
	metadata = {
		key: value for key, value in key_value.split("=")
		for key_value in pairs
	} 
	return RecordingMetadata(
		recorder_id=metadata["recorder_id"]
		started_at=metadata["started_at"]
		session_name=metadata["session_name"]
	)


def _upload_to_s3(recordings: dict[str, RecordingMetadata]  , s3_bucket: str)
	s3_client = boto3.client("s3")
	for filepath, metadata in recordings.items():
		object_key = f"{metadata.recorder_id}/{metadata_.session}_{metadata.starte
```

With these type hints, another upside emerge, which is that the task of validating that `RecordingMetadata` are created with all the expected data can be delagated to a type checker (such a `mypy` or `pyright`) rather than checked manually through unit tests.


Moreover, once we have explicitly defined the shape of our data

Which, in the author's opinion, tends to make for a more concise and readable codebase when applied with restraint.
```python
@dataclass
class RecordingMetadata:
	recorder_id: str
	started_at: str
	session_name: str

	@classmethod
	def from_file(cls, path: os.Pathlike):
		with open(filepath, "r") as f:
			first_line = f.readline()
		first_line.removeprefix("# ")
		pairs = first_line.split(",)
		metadata = {
			key: value for key, value in key_value.split("=")
			for key_value in pairs
		} 
		return cls(
			recorder_id = metadata["recorder_id"]
			started_at = metadata["started_at"]
			session_name = metadata["session_name"]
		)

	@property
	def s3_key(self) -> str:
		return f"{self.recorder_id}/{self.session_name}_{self.started_at}"


def upload_directory(directory: os.Pathlike, s3_bucket: str):
	recordings = _get_recordings_info(directory)
	upload_recordings(recordings, s3_bucket)


def _extract_metadata(directory: os.Pathlike) -> dict[str, RecordingMetadata]:
	recordings = {} # (1)
	for file_name in os.lisdir(directory):
		file_path = os.path.join(directory, file_name)
		recordings(filepath) = RecoderMetada.from_file(path)
	return recordings


def _upload_to_s3(recordings dict[str, RecordingMetadata], s3_bucket: str):
	s3_client = boto3.client("s3")
	for filepath, metadata in recordings.items():
		s3.upload_file(filepath, s3_bucket, metadata.s3_key)

```

# Exceptions

Performance. While attribute access performance for `dataclasse`s is only slightly worse than for dicts, instantiating a `dataclass` is at least 5x slower than a `dict`[^1], so if you're instantiating 1000s of these and you've determined that this is a bottleneck by profiling your code, a `dict` may be preferred

Near serialization/deserialization code: a lot of libraries take or produce `dict` s at their API boundaries, and it may be simpler to just construct the dict directly if the `dict` is used directly there without being passed to another function

[^1]: "If you need to construct that many objects, don't use Python" is a bad argument. Sometimes processing that many objects is needed, but you don't want to write a whole Cython or C extension module and add a compilation step to your build system *just* for one hot loop