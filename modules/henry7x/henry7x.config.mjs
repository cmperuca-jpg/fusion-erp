import { readTextFile, parseKeyValueLoose, inspectBinaryLikeFile } from './henry7x.parser.mjs';

export function importarCfg7x(path) {
  const text = readTextFile(path);
  return { tipo: 'cfg7x', ...parseKeyValueLoose(text), inspecao: inspectBinaryLikeFile(path) };
}

export function importarLay7x(path) {
  const text = readTextFile(path);
  return { tipo: 'lay7x', ...parseKeyValueLoose(text), inspecao: inspectBinaryLikeFile(path) };
}
