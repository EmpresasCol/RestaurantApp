import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api.dart';
import '../theme/qpro_theme.dart';
import '../widgets/q.dart';

/// Un solo login: la app reconoce si el usuario es mesero o domiciliario.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _usuario = TextEditingController();
  final _clave = TextEditingController();
  bool _verClave = false;
  String? _error;

  @override
  void dispose() {
    _usuario.dispose();
    _clave.dispose();
    super.dispose();
  }

  Future<void> _entrar() async {
    FocusScope.of(context).unfocus();
    if (!_form.currentState!.validate()) return;
    setState(() => _error = null);
    try {
      await context.read<AuthProvider>().login(_usuario.text, _clave.text);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.mensaje == 'Credenciales inválidas' ? 'Usuario o clave incorrectos' : e.mensaje);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final t = Theme.of(context).textTheme;

    return Scaffold(
      backgroundColor: QColors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: AutofillGroup(
                child: Form(
                  key: _form,
                  child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    const Align(alignment: Alignment.centerLeft, child: LogoQpro(tamano: 64)),
                    const SizedBox(height: 28),
                    Text('Inicia sesión', style: t.headlineMedium?.copyWith(fontSize: 30)),
                    const SizedBox(height: 8),
                    Text('Meseros y domiciliarios entran con el usuario que les dio el administrador.', style: t.bodyLarge?.copyWith(color: QColors.stone500)),
                    if (auth.sesionVencida) ...[
                      const SizedBox(height: 20),
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(color: QColors.tealWash, borderRadius: BorderRadius.circular(QRadius.control)),
                        child: const Row(children: [
                          Icon(Icons.info_outline_rounded, color: QColors.tealDeep, size: 20),
                          SizedBox(width: 10),
                          Expanded(child: Text('Tu sesión venció. Entra de nuevo para seguir.', style: TextStyle(color: QColors.tealDeep, fontWeight: FontWeight.w600))),
                        ]),
                      ),
                    ],
                    const SizedBox(height: 28),
                    TextFormField(
                      controller: _usuario,
                      decoration: const InputDecoration(labelText: 'Usuario', prefixIcon: Icon(Icons.person_outline_rounded)),
                      textInputAction: TextInputAction.next,
                      autocorrect: false,
                      enableSuggestions: false,
                      autofillHints: const [AutofillHints.username],
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Escribe tu usuario' : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _clave,
                      obscureText: !_verClave,
                      decoration: InputDecoration(
                        labelText: 'Clave',
                        prefixIcon: const Icon(Icons.lock_outline_rounded),
                        suffixIcon: IconButton(
                          tooltip: _verClave ? 'Ocultar clave' : 'Mostrar clave',
                          icon: Icon(_verClave ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                          onPressed: () => setState(() => _verClave = !_verClave),
                        ),
                      ),
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.password],
                      onFieldSubmitted: (_) => _entrar(),
                      validator: (v) => (v == null || v.isEmpty) ? 'Escribe tu clave' : null,
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 14),
                      Semantics(
                        liveRegion: true,
                        child: Text(_error!, style: const TextStyle(color: QColors.dangerDeep, fontWeight: FontWeight.w700)),
                      ),
                    ],
                    const SizedBox(height: 24),
                    QBoton(texto: 'Entrar', onPressed: _entrar, cargando: auth.cargando, alto: 56, expandir: true),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
