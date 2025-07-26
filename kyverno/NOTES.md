# Kyverno Policy Development Notes

## Context
We attempted to create a Kyverno policy to restrict namespace changes to only allow annotation modifications, blocking changes to labels, spec, or other fields.

## What We Built
- **Policy**: `kyverno/policy.yaml` - ClusterPolicy that denies namespace UPDATE operations that modify anything other than annotations
- **Test Resources**: Basic namespace resources in `kyverno/resources/`
- **Test File**: `kyverno/kyverno-test.yaml` - CLI test configuration

## Policy Logic
```yaml
validate:
  message: "Only annotations can be modified on namespaces"
  deny:
    conditions:
      any:
      - key: "{{ request.object | omit(@, 'metadata.annotations', 'metadata.resourceVersion', 'metadata.managedFields') }}"
        operator: NotEquals
        value: "{{ request.oldObject | omit(@, 'metadata.annotations', 'metadata.resourceVersion', 'metadata.managedFields') }}"
```

## Issue Encountered
**CLI Testing Limitation**: Kyverno CLI tests don't properly handle `request.oldObject` for UPDATE operations. The policy relies on comparing old vs new resource states, but CLI testing shows "Excluded" results instead of proper validation.

## Research Done
- **Bug #9885**: "request.OldObject is null for an UPDATE request" 
- **Bug #8644**: Issues with testing validation policies for different operations
- CLI test framework has known limitations around `request.oldObject` handling

## Community Discussion
Posted question to Kyverno discussions: https://github.com/kyverno/kyverno/discussions/13696
Waiting for community guidance on proper testing approaches for UPDATE validation policies.

## Current Status
- Policy syntax is correct and should work in actual cluster
- CLI testing blocked due to framework limitations
- Need community input on testing strategies

## Next Steps (Future)
1. Check discussion responses for testing guidance
2. Consider deploying policy to actual cluster for testing
3. May need alternative policy approach that doesn't rely on `request.oldObject` comparison
4. Could explore pattern-based validation instead of deny conditions

## Files Created
```
kyverno/
├── policy.yaml                    # Main ClusterPolicy
├── kyverno-test.yaml             # CLI test configuration  
├── resources/
│   ├── original-namespace.yaml   # Base namespace
│   └── namespace-with-label.yaml # Modified namespace
└── NOTES.md                      # This file
```

## Key Learnings
- Kyverno CLI testing has limitations for complex validation scenarios
- `request.oldObject` comparison is powerful but testing support varies
- Community discussions are valuable for clarifying framework capabilities
- JMESPath `omit()` function works for excluding fields from comparison
- UPDATE operations in Kyverno match both PATCH and PUT requests to the API server