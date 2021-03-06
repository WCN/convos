use t::Helper;
use Convos::Core;
use Convos::Core::Backend::File;

my $core = Convos::Core->new;
my $connection = $core->user({email => 'test.user@example.com'})
  ->connection({name => 'localhost', protocol => 'irc'});
my ($err, @state);

$connection->on(state => sub { push @state, $_[2]->{state} });

$connection->connect(sub { $err = $_[1]; Mojo::IOLoop->stop; });
Mojo::IOLoop->start;
like $err, qr{Invalid URL}, 'invalid url';

is $connection->_irc->nick, 'testuser', 'converted username to nick';

$connection->url->parse('irc://127.0.0.1');
no warnings qw(once redefine);
*Mojo::IRC::connect = sub {
  pop->(
    $_[0],
    "SSL connect attempt failed error:140770FC:SSL routines:SSL23_GET_SERVER_HELLO:unknown protocol"
  );
};
is $connection->url->query->param('tls'), undef, 'enable tls';
$connection->connect(sub { $err = $_[1]; Mojo::IOLoop->stop; });
Mojo::IOLoop->start;
is_deeply \@state, [qw(queued disconnected)], 'queued => disconnected';
like $err, qr{\bSSL connect attempt failed\b}, 'SSL connect attempt';
is $connection->url->query->param('tls'), 0, 'disable tls';

*Mojo::IRC::connect = sub { pop->($_[0], "IO::Socket::SSL 1.94+ required for TLS support") };
$connection->url->query->remove('tls');
$connection->connect(sub { $err = $_[1]; Mojo::IOLoop->stop; });
Mojo::IOLoop->start;
like $err, qr{\bIO::Socket::SSL\b}, 'IO::Socket::SSL missing';
is $connection->url->query->param('tls'), 0, 'disable tls';
is_deeply \@state, [qw(queued disconnected queued disconnected)], 'queued => disconnected';

*Mojo::IRC::connect = sub { pop->($_[0], '') };
$connection->connect(sub { $err = $_[1]; Mojo::IOLoop->stop; });
Mojo::IOLoop->start;
is $err, '', 'no error';
is_deeply \@state, [qw(queued disconnected queued disconnected queued connected)], 'connected';

done_testing;
