from sift.models import Provider
from sift.util import html_to_text, parse_address, truncate

from .conftest import make_email


def test_sender_domain():
    assert make_email(sender="a@Example.COM").sender_domain == "example.com"
    assert make_email(sender="bad-address").sender_domain == ""


def test_header_lookup_is_case_insensitive():
    e = make_email(headers={"List-Unsubscribe": "<mailto:u@x.com>"})
    assert e.header("list-unsubscribe") == "<mailto:u@x.com>"
    assert e.header("Missing") is None


def test_html_to_text_strips_tags_and_scripts():
    html = "<html><style>.a{}</style><body><p>Hello&nbsp;<b>World</b></p><script>x()</script></body></html>"
    text = html_to_text(html)
    assert "Hello" in text and "World" in text
    assert "<" not in text and "x()" not in text


def test_parse_address():
    name, addr = parse_address("Alice Smith <Alice@Example.com>")
    assert name == "Alice Smith"
    assert addr == "alice@example.com"


def test_truncate():
    assert truncate("hello", 10) == "hello"
    assert truncate("hello world", 6).endswith("…")
