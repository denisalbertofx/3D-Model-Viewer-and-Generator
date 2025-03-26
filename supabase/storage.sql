-- Crear bucket para modelos si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('models', 'models', true)
ON CONFLICT (id) DO NOTHING;

-- Permitir que usuarios autenticados lean modelos (públicos y propios)
CREATE POLICY "Modelos visibles para usuarios autenticados" ON storage.objects
FOR SELECT
USING (
  bucket_id = 'models' AND
  auth.role() = 'authenticated'
);

-- Permitir que usuarios autenticados suban modelos
CREATE POLICY "Usuarios autenticados pueden subir modelos" ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'models' AND
  auth.role() = 'authenticated' AND
  (storage.foldername(name))[1] = 'models'
);

-- Permitir que usuarios actualicen sus propios modelos
CREATE POLICY "Usuarios pueden actualizar sus propios modelos" ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'models' AND
  auth.role() = 'authenticated' AND
  owner = auth.uid()
)
WITH CHECK (
  bucket_id = 'models' AND
  auth.role() = 'authenticated' AND
  owner = auth.uid()
);

-- Permitir que usuarios eliminen sus propios modelos
CREATE POLICY "Usuarios pueden eliminar sus propios modelos" ON storage.objects
FOR DELETE
USING (
  bucket_id = 'models' AND
  auth.role() = 'authenticated' AND
  owner = auth.uid()
); 