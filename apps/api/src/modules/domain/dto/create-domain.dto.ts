import { IsString, IsNotEmpty, MaxLength, Matches, IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * A registrable hostname: at least two labels, each 1-63 characters, no leading
 * or trailing hyphen, ending in an alphabetic TLD of 2+ characters.
 *
 * The `(?:label\.)+` is a `+` rather than a `*` on purpose. With `*` the pattern
 * also matched bare single-label strings - `localhost`, and more worryingly
 * `com` - which are not hostnames a business can own and which would have taken
 * a global uniqueness claim on a bare TLD string. Users who want a local test
 * name use `app.localhost`, which is both valid here and sandbox-eligible.
 */
const HOSTNAME_PATTERN =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export class CreateDomainDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(253)
  @Matches(HOSTNAME_PATTERN, {
    message: 'domain must be a hostname such as example.com',
  })
  /**
   * Normalised before validation so that users can paste whatever their browser
   * shows them. `https://WWW.Example.com/pricing` and `example.com` are the
   * same claim, and rejecting the former on a technicality is a needless wall.
   */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeDomainInput(value) : value,
  )
  domain!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

/**
 * Shared with the frontend's client-side normaliser so both ends agree on what
 * a user's paste means. Strips scheme, credentials, `www.`, port, path, query,
 * fragment and a trailing root dot.
 */
export function normalizeDomainInput(raw: string): string {
  let value = raw.trim().toLowerCase();
  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, ''); // scheme
  value = value.replace(/^[^/@]*@/, ''); // userinfo
  value = value.split(/[/?#]/)[0] ?? ''; // path, query, fragment
  value = value.replace(/:\d+$/, ''); // port
  value = value.replace(/^www\./, '');
  value = value.replace(/\.+$/, ''); // trailing root dot
  return value;
}
