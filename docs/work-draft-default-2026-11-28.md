# Work draft inheritance after model discovery

Atum Desktop supplies a subscription-backed model through T3's environment default. The Work client can already have seeded an unsent draft before the host finishes probing for connected models. Embedded Work refreshes that seed from the current project or environment default. A draft with an explicit model and a thread already promoted to the server keep their selections.

The ranking stays in Atum Desktop's shared Agent picker. The Web client uses T3's existing settings and composer state. Release the change in a new Work archive and pin it alongside the Desktop host change.

Focused unit tests use the composer draft store to verify that late discovery updates an inherited selection while retaining its prompt and that an explicit picker selection wins.
