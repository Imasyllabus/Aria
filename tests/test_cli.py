import sift.providers as providers_mod
from sift.cli import main
from sift.models import Provider


class _FakeProvider:
    name = Provider.GMAIL

    def whoami(self):
        return "you@example.com (5 messages total)"


def test_auth_reports_connected(monkeypatch, capsys):
    monkeypatch.setattr(providers_mod, "build_provider", lambda p, c: _FakeProvider())
    rc = main(["auth", "--provider", "gmail"])
    out = capsys.readouterr().out
    assert rc == 0
    assert "connected" in out and "you@example.com" in out


def test_auth_reports_failure(monkeypatch, capsys):
    class _Bad:
        def whoami(self):
            raise RuntimeError("credentials.json not found")

    monkeypatch.setattr(providers_mod, "build_provider", lambda p, c: _Bad())
    rc = main(["auth", "--provider", "gmail"])
    err = capsys.readouterr().err
    assert rc == 1
    assert "NOT connected" in err
