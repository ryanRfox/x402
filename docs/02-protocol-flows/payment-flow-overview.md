# Payment Flow Overview

High-level overview of how the x402 payment protocol works from request to settlement.

## Simple Flow Diagram

```mermaid
sequenceDiagram
    participant Client
    participant Server
    participant Facilitator
    participant Blockchain

    Client->>Server: 1. GET /protected
    Server->>Client: 2. 402 Payment Required<br/>+ Payment instructions

    Note over Client: 3. Create & sign payment<br/>(using wallet)

    Client->>Server: 4. GET /protected<br/>+ Payment signature
    Server->>Facilitator: 5. Verify payment
    Facilitator->>Server: 6. Verification result
    Server->>Facilitator: 7. Settle payment
    Facilitator->>Blockchain: 8. Execute transaction
    Blockchain->>Facilitator: 9. Confirmation
    Facilitator->>Server: 10. Settlement result
    Server->>Client: 11. 200 OK<br/>+ Response data<br/>+ Settlement details
```

## Key Phases

### Phase 1: Discovery
Client learns what payment is required

### Phase 2: Authorization
Client creates cryptographic proof of payment

### Phase 3: Verification
Server/Facilitator confirms payment is valid

### Phase 4: Execution
Business logic runs (only if payment valid)

### Phase 5: Settlement
Payment is executed on blockchain

See [Happy Path](./happy-path.md) for detailed step-by-step walkthrough.

## Next Steps

- **Detailed Flow**: [Happy Path](./happy-path.md)
- **Error Handling**: [Error Scenarios](./error-scenarios.md)
- **Network Differences**: [Network Variations](./network-variations.md)
