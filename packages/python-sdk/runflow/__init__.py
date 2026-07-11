"""RunFlow Python SDK for job scripts."""

from runflow.args import ArgsProxy, get_args
from runflow import result

__all__ = ["get_args", "result", "args"]

args = ArgsProxy()
