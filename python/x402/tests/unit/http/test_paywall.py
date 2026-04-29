"""Tests for paywall handlers and faucet URL plumbing."""

from __future__ import annotations

from x402.http.paywall import (
    EvmPaywallHandler,
    PaywallBuilder,
    SvmPaywallHandler,
)
from x402.mechanisms.evm.constants import NETWORK_CONFIGS as EVM_NETWORK_CONFIGS
from x402.mechanisms.svm.constants import NETWORK_CONFIGS as SVM_NETWORK_CONFIGS
from x402.schemas import (
    PaymentRequired,
    PaymentRequirements,
    ResourceInfo,
)


def _make_evm_payment_required() -> PaymentRequired:
    return PaymentRequired(
        x402_version=2,
        accepts=[
            PaymentRequirements(
                scheme="exact",
                network="eip155:84532",
                asset="0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                amount="1000000",
                pay_to="0x209693Bc6afc0C5328bA36FaF04C514EF312287C",
                max_timeout_seconds=60,
            )
        ],
        resource=ResourceInfo(url="https://example.com/api/data"),
    )


def _make_svm_payment_required() -> PaymentRequired:
    return PaymentRequired(
        x402_version=2,
        accepts=[
            PaymentRequirements(
                scheme="exact",
                network="solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
                asset="4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
                amount="1000000",
                pay_to="2wKupLR9q6wXYppw8Gr2NvWxKBUqm4PPJKkQfoxHEBg4",
                max_timeout_seconds=60,
            )
        ],
        resource=ResourceInfo(url="https://example.com/api/data"),
    )


# --- EvmPaywallHandler ---


def _build_evm_provider(**config_kwargs):  # type: ignore[no-untyped-def]
    return PaywallBuilder().with_network(EvmPaywallHandler()).with_config(**config_kwargs).build()


def _build_svm_provider(**config_kwargs):  # type: ignore[no-untyped-def]
    return PaywallBuilder().with_network(SvmPaywallHandler()).with_config(**config_kwargs).build()


def test_evm_handler_injects_faucet_url() -> None:
    provider = _build_evm_provider(testnet=True, faucet_url="https://example.com/faucet")
    html = provider.generate_html(_make_evm_payment_required())
    assert '"faucetUrl": "https://example.com/faucet"' in html


def test_evm_handler_injects_faucet_urls() -> None:
    urls = {
        "eip155:84532": "https://example.com/base-sepolia",
        "eip155:421614": "https://example.com/arb-sepolia",
    }
    provider = _build_evm_provider(testnet=True, faucet_urls=urls)
    html = provider.generate_html(_make_evm_payment_required())
    assert '"faucetUrls"' in html
    assert "https://example.com/base-sepolia" in html
    assert "https://example.com/arb-sepolia" in html


def test_evm_handler_omits_faucet_url_when_unset() -> None:
    """When faucet_url/faucet_urls are unset, the injected config script omits
    the keys so the React bundle's precedence chain falls through to
    `FAUCET_URLS[caip2]` and the hardcoded default. The bundled template can
    still mention `faucetUrl` as a property access in compiled JS — that's
    fine — we only assert the injected `window.x402 = {...}` config doesn't
    declare the key.
    """
    provider = _build_evm_provider(testnet=True)
    html = provider.generate_html(_make_evm_payment_required())
    # Find the config script block and check it doesn't declare faucet keys.
    # `htmlsafe_json_dumps` produces `"key":` — JSON-style with quoted key.
    config_marker = "window.x402 = "
    assert config_marker in html
    # Locate the JSON object literal that follows the marker. It ends at the
    # matching `}`. Take a generous slice and check for absent keys.
    start = html.index(config_marker) + len(config_marker)
    snippet = html[start : start + 4096]
    assert '"faucetUrl"' not in snippet, f"unexpected faucetUrl in injected config: {snippet[:500]}"
    assert '"faucetUrls"' not in snippet, (
        f"unexpected faucetUrls in injected config: {snippet[:500]}"
    )


# --- SvmPaywallHandler ---


def test_svm_handler_injects_faucet_url() -> None:
    provider = _build_svm_provider(testnet=True, faucet_url="https://example.com/faucet")
    html = provider.generate_html(_make_svm_payment_required())
    assert '"faucetUrl": "https://example.com/faucet"' in html


def test_svm_handler_injects_faucet_urls() -> None:
    urls = {"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1": "https://example.com/devnet"}
    provider = _build_svm_provider(testnet=True, faucet_urls=urls)
    html = provider.generate_html(_make_svm_payment_required())
    assert '"faucetUrls"' in html
    assert "https://example.com/devnet" in html


# --- PaywallBuilder ---


def test_builder_accepts_faucet_url_and_faucet_urls() -> None:
    urls = {"eip155:84532": "https://example.com/base"}
    provider = (
        PaywallBuilder()
        .with_network(EvmPaywallHandler())
        .with_config(faucet_url="https://example.com/global", faucet_urls=urls)
        .build()
    )
    assert provider.faucet_url == "https://example.com/global"
    assert provider.faucet_urls == urls


def test_builder_passes_faucet_config_through_to_handler() -> None:
    urls = {"eip155:84532": "https://example.com/base"}
    provider = (
        PaywallBuilder()
        .with_network(EvmPaywallHandler())
        .with_config(faucet_url="https://example.com/global", faucet_urls=urls)
        .build()
    )
    html = provider.generate_html(_make_evm_payment_required())
    assert "https://example.com/global" in html
    assert "https://example.com/base" in html


# --- Registry seed pinning ---


def test_evm_registry_faucet_url_seeds_match_design() -> None:
    """Pin EVM testnet faucet URL seeds across DEFAULT_STABLECOINS-equivalent.

    Mirrors the TS-side ``FAUCET_URLS`` drift test against
    ``DEFAULT_STABLECOINS`` and the Go-side seed test in ``paywall_test.go``.
    """
    expected = {
        "eip155:84532": "https://faucet.circle.com/",
        "eip155:421614": "https://faucet.circle.com/",
        "eip155:31611": "https://faucet.test.mezo.org/",
        "eip155:2201": "https://faucet.stable.xyz/faucet",
    }
    for caip2, want in expected.items():
        assert caip2 in EVM_NETWORK_CONFIGS, f"missing EVM NETWORK_CONFIG for {caip2}"
        config = EVM_NETWORK_CONFIGS[caip2]
        got = config["default_asset"].get("faucet_url")
        assert got == want, f"EVM faucet_url for {caip2}: got {got!r}, want {want!r}"


def test_svm_registry_faucet_url_seeds_match_design() -> None:
    """Pin SVM faucet URL seeds — both Solana devnet and testnet → Circle."""
    expected = {
        "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1": "https://faucet.circle.com/",
        "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z": "https://faucet.circle.com/",
    }
    for caip2, want in expected.items():
        assert caip2 in SVM_NETWORK_CONFIGS, f"missing SVM NETWORK_CONFIG for {caip2}"
        config = SVM_NETWORK_CONFIGS[caip2]
        got = config["default_asset"].get("faucet_url")
        assert got == want, f"SVM faucet_url for {caip2}: got {got!r}, want {want!r}"


def test_evm_mainnet_entries_have_no_faucet_url() -> None:
    """Mainnet entries leave faucet_url unset by convention.

    The paywall faucet UI is testnet-gated, so mainnet entries never render
    the link. Pinning this prevents accidental seed drift onto a mainnet
    entry from creating dead-data.
    """
    mainnets = ["eip155:8453", "eip155:42161", "eip155:137"]
    for caip2 in mainnets:
        if caip2 not in EVM_NETWORK_CONFIGS:
            continue
        config = EVM_NETWORK_CONFIGS[caip2]
        assert "faucet_url" not in config["default_asset"], (
            f"mainnet {caip2} has unexpected faucet_url"
        )
