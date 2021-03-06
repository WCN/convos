use t::Helper;
use File::Basename;
use File::Path 'make_path';

plan skip_all => 'cpanm CSS::Sass' unless eval 'use CSS::Sass 3.3.0;1';

my $variables = File::Spec->catfile($ENV{CONVOS_HOME}, qw(assets sass _variables.scss));

eval { make_path(dirname($variables)) } or diag $@;
open my $FH, '>', $variables or plan skip_all => "Write $variables: $!";
print $FH "\$body-bg: #123321;\n";
close $FH;

$ENV{MOJO_MODE} = 'production';
my $t = t::Helper->t;
$t->get_ok('/')->status_is(200);
$t->get_ok($t->tx->res->dom->at('link[rel="stylesheet"]')->{href})->status_is(200)
  ->content_like(qr{background-color:\s*\#123321;});

done_testing;
