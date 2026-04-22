// app/restaurant_app/lib/screens/domiciliario/login_domiciliario_screen.dart

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../../providers/domiciliario_provider.dart';
import 'home_domiciliario_screen.dart';

class LoginDomiciliarioScreen extends StatefulWidget {
  const LoginDomiciliarioScreen({super.key});

  @override
  State<LoginDomiciliarioScreen> createState() => _LoginDomiciliarioScreenState();
}

class _LoginDomiciliarioScreenState extends State<LoginDomiciliarioScreen> {
  final _formKey = GlobalKey<FormState>();
  final _userCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _cargando = false;
  bool _ocultarClave = true;

  @override
  void dispose() {
    _userCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _cargando = true);

    try {
      final provider = context.read<DomiciliarioProvider>();
      await provider.login(_userCtrl.text.trim(), _passCtrl.text);

      // Suscribirse al topic de FCM para recibir avisos en tiempo real.
      try {
        await FirebaseMessaging.instance.subscribeToTopic('domiciliarios');
      } catch (_) {}

      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const HomeDomiciliarioScreen()),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: Colors.red.shade700,
        ),
      );
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF3F291A),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Card(
              elevation: 8,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 80,
                        height: 80,
                        decoration: const BoxDecoration(
                          color: Color(0xFFC79B64),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.delivery_dining,
                            size: 48, color: Colors.white),
                      ),
                      const SizedBox(height: 16),
                      const Text('QPro · Domiciliario',
                          style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF3F291A))),
                      const SizedBox(height: 4),
                      Text('Ingresa con las credenciales que te dio tu administrador',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.grey.shade600)),
                      const SizedBox(height: 24),
                      TextFormField(
                        controller: _userCtrl,
                        decoration: const InputDecoration(
                          labelText: 'Usuario',
                          prefixIcon: Icon(Icons.person_outline),
                        ),
                        textInputAction: TextInputAction.next,
                        autocorrect: false,
                        enableSuggestions: false,
                        validator: (v) =>
                            (v == null || v.trim().isEmpty) ? 'Ingresa tu usuario' : null,
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _passCtrl,
                        obscureText: _ocultarClave,
                        decoration: InputDecoration(
                          labelText: 'Contraseña',
                          prefixIcon: const Icon(Icons.lock_outline),
                          suffixIcon: IconButton(
                            icon: Icon(_ocultarClave
                                ? Icons.visibility_off
                                : Icons.visibility),
                            onPressed: () =>
                                setState(() => _ocultarClave = !_ocultarClave),
                          ),
                        ),
                        validator: (v) =>
                            (v == null || v.isEmpty) ? 'Ingresa tu contraseña' : null,
                        onFieldSubmitted: (_) => _submit(),
                      ),
                      const SizedBox(height: 24),
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: ElevatedButton(
                          onPressed: _cargando ? null : _submit,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFE28D41),
                            foregroundColor: Colors.white,
                          ),
                          child: _cargando
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2, color: Colors.white))
                              : const Text('Iniciar sesión',
                                  style: TextStyle(
                                      fontSize: 16, fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
