---
title: "Don't make a utils file"
date: 2026-01-19T18:46:13-08:00
tags: []
draft: false
---

Maybe it contains some core data structures that are used across the application? how
about `datastructures.py`? Maybe it's a common way of configguring a logger. Make it
`log.py`.


## Example: the lifecycle of an email utility

This also enables a really neat pattern where you can grow your application
progressively without breaking any of your callers.

```text
app
|__ emails.py
```
to
```text
app
|_ emails
   |_  __init__.py
   |_ _validation.py
   |_ _delivery.py
   |_ _subscription.py
```

in a way that doesn't break your callers.

```py
# __init__.py

from ._delivery import send
from ._subscription import subscribe, unsubscribe
from ._validation import validate

__all__ = [
    "send",
    "subscribe",
    "unsubscribe",
    "validate",
]
```

You can do something like this in most programming languages. For instance, in Golang,
a package might start out a one file, and then you split it into multiple files as your
logic gets more complicated.
