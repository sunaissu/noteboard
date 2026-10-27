The Calculator tarball is built from the local @sunaissu/calculator 1.1.0-rc.2
source for the playground's calculation-card example. It includes its MIT
license. It is a local snapshot, not a claim that the identical archive was
published to npm. The playground lockfile records its integrity.

To update it, run npm pack in the Calculator repository with this directory as
the pack destination, then reinstall the file dependency and rebuild Noteboard's
playground. A normal Noteboard deployment does not require that sibling checkout.
