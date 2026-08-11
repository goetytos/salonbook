# Customer identity and guest bookings

Public bookings create passwordless guest customer rows. Customer signup always
creates a separate credentialed row, even when its normalized phone number and
display name match a guest. Existing bookings remain attached to the guest row.

Names and phone-number text are lookup attributes, not proof of ownership. Code
must not copy, merge, or reassign bookings on those values alone.

Linking historical guest bookings is intentionally deferred. A future flow must
first verify control of the phone number with an OTP, then perform an explicit,
auditable transaction with collision and rollback handling. Until that exists,
customers may see only bookings made through their credentialed account.
