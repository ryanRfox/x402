"""Regression tests for paywall display-amount decimal handling.

The paywall renders the on-wire ``amount`` (token smallest unit) as a
human-readable USD-style value. Historically it divided by a hardcoded
``1_000_000`` ("USDC 6 decimals"), which renders 18-decimal default assets
(Mezo mUSD, MegaETH MegaUSD) off by a factor of 1e12. These tests guard the
decimals-aware conversion in both call sites.
"""

import pytest

from x402.http.paywall import _get_display_amount
from x402.http.utils import resolve_display_decimals
from x402.http.x402_http_server_base import x402HTTPServerBase
from x402.schemas.payments import PaymentRequired, PaymentRequirements

# Real default-asset entries from x402.mechanisms.evm.constants.NETWORK_CONFIGS.
USDC_BASE_SEPOLIA = ("eip155:84532", "0x036CbD53842c5426634e7929541eC2318f3dCF7e")  # 6 dec
MUSD_MEZO_TESTNET = ("eip155:31611", "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503")  # 18 dec
MEGAUSD_MEGAETH = ("eip155:4326", "0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7")  # 18 dec


def _payment_required(network: str, asset: str, amount: str) -> PaymentRequired:
    return PaymentRequired(
        accepts=[
            PaymentRequirements(
                scheme="exact",
                network=network,
                asset=asset,
                amount=amount,
                pay_to="0x0000000000000000000000000000000000000001",
                max_timeout_seconds=60,
            )
        ]
    )


class TestResolveDisplayDecimals:
    def test_usdc_six_decimals(self):
        assert resolve_display_decimals(*USDC_BASE_SEPOLIA) == 6

    def test_mezo_musd_eighteen_decimals(self):
        assert resolve_display_decimals(*MUSD_MEZO_TESTNET) == 18

    def test_megaeth_megausd_eighteen_decimals(self):
        assert resolve_display_decimals(*MEGAUSD_MEGAETH) == 18

    def test_unknown_network_defaults_to_six(self):
        assert resolve_display_decimals("eip155:999999", USDC_BASE_SEPOLIA[1]) == 6

    def test_non_evm_network_defaults_to_six(self):
        # Solana mints are not eip155; get_asset_info raises and we fall back.
        assert resolve_display_decimals("solana:mainnet", "EPjFW...mint") == 6

    def test_non_default_asset_on_known_network_defaults_to_six(self):
        # Right network, wrong address -> not a registered default -> 6.
        non_default = "0x1111111111111111111111111111111111111111"
        assert resolve_display_decimals(USDC_BASE_SEPOLIA[0], non_default) == 6

    def test_missing_inputs_default_to_six(self):
        assert resolve_display_decimals(None, None) == 6
        assert resolve_display_decimals("eip155:31611", None) == 6
        assert resolve_display_decimals(None, MUSD_MEZO_TESTNET[1]) == 6


class TestGetDisplayAmount:
    def test_usdc_six_decimals_unchanged(self):
        pr = _payment_required(*USDC_BASE_SEPOLIA, amount="1000000")  # 1 USDC
        assert _get_display_amount(pr) == pytest.approx(1.0)

    def test_mezo_musd_eighteen_decimals(self):
        # $0.001 mUSD == 1e15 atomic units. Old code: 1e15/1e6 = 1e9 (wrong).
        pr = _payment_required(*MUSD_MEZO_TESTNET, amount="1000000000000000")
        result = _get_display_amount(pr)
        assert result == pytest.approx(0.001)
        assert result != pytest.approx(1e9)  # guard against the 1e12 regression

    def test_megaeth_megausd_eighteen_decimals(self):
        pr = _payment_required(*MEGAUSD_MEGAETH, amount="10000000000000000")  # 0.01
        assert _get_display_amount(pr) == pytest.approx(0.01)

    def test_unknown_asset_falls_back_to_six(self):
        pr = _payment_required("eip155:999999", USDC_BASE_SEPOLIA[1], amount="2500000")
        assert _get_display_amount(pr) == pytest.approx(2.5)

    def test_no_accepts_returns_zero(self):
        assert _get_display_amount(PaymentRequired(accepts=[])) == 0.0


class TestServerBaseStaticCopy:
    """The sibling copy on x402HTTPServerBase must apply the same conversion."""

    def test_static_method_uses_token_decimals(self):
        pr = _payment_required(*MUSD_MEZO_TESTNET, amount="1000000000000000")
        assert x402HTTPServerBase._get_display_amount(pr) == pytest.approx(0.001)

    def test_static_method_usdc_unchanged(self):
        pr = _payment_required(*USDC_BASE_SEPOLIA, amount="1000000")
        assert x402HTTPServerBase._get_display_amount(pr) == pytest.approx(1.0)
