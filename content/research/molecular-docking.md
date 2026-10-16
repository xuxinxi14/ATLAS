---
id: skill-molecular-docking
title: AutoDock Vina 分子对接标准流程概览
slug: research/molecular-docking
type: skill
category: research
subcategory: structural-biology
tags: [分子对接, AutoDock Vina, PyMOL, 结构生物学]
status: review
summary: 受体蛋白去水加氢、配体小分子 3D 构象能量最小化、Grid Box 活性口袋设置与结合能结果判读。
created: 2026-03-10
updated: 2026-03-15
version_scope: "AutoDock Vina 1.2.x / PyMOL 2.5"
source_urls:
  - https://autodock-vina.readthedocs.io/
prerequisites: []
related:
  - concept-enzyme-kinetics
aliases: []
---

# AutoDock Vina 分子对接标准流程概览

## 快速复习

1. **受体准备（Receptor）**：从 PDB 下载结构 → 删除结晶水与无关辅因子 → 补齐缺失氢原子（极性氢）与 Gasteiger 电荷 → 导出 `.pdbqt`。
2. **配体准备（Ligand）**：从 PubChem 获取 SDF 或由 SMILES 生成 3D 构象 → MMFF94 力场能量最小化 → 设定可旋转键（Torsion Tree）→ 导出 `.pdbqt`。
3. **对接盒子（Grid Box）**：以原结晶配体质心或预测口袋为中心，边长通常设为 `20 Å × 20 Å × 20 Å`（确保包裹整个活性位点且不过大）。
4. **判读经验阈值**：Vina 结合自由能 $\Delta G \le -7.0\text{ kcal/mol}$ 通常指示较强结合潜力，但必须结合 **氢键距离（< 3.5 Å）** 与疏水相互作用构象合理性综合判断。

## 适用场景

靶标蛋白与候选小分子化合物的虚拟筛选、结合模式（Binding Pose）预测及突变体亲和力变化解释。

## 前置准备

- 已安装 `AutoDock Vina`、`AutoDockTools (MGLTools)` 或 `Meeko`、`OpenBabel`、`PyMOL`
- 靶标蛋白晶体结构（优先选择分辨率 $< 2.5\text{ \AA}$ 且含共晶配体的 PDB 条目）

## 操作步骤

### 1. 编写 Vina 对接配置文件 `config.txt`

```ini
receptor = receptor.pdbqt
ligand   = ligand.pdbqt

center_x = 14.520
center_y = -8.310
center_z = 22.140

size_x   = 22.0
size_y   = 22.0
size_z   = 22.0

exhaustiveness = 16
num_modes      = 9
energy_range   = 3
```

### 2. 运行对接与重对接验证（Redocking）

```bash
# 运行 Vina 对接并输出日志
vina --config config.txt --out docked_poses.pdbqt --log vina_dock.log
```

> **金标准控制（Redocking）**：正式对接未知化合物前，务必先把原晶体中的共晶配体抽出来重对接回原口袋，计算预测构象与晶体构象的 $\text{RMSD}$。当 $\text{RMSD} < 2.0\text{ \AA}$ 时，说明当前参数与盒子设置可靠。

## 验证结果

- `docked_poses.pdbqt` 生成多个打分构象，Mode 1 结合能最低；
- 在 PyMOL 中载入受体与 Mode 1 配体，检查关键催化残基是否形成稳定氢键、盐桥或 $\pi-\pi$ 堆积，且无明显空间位阻碰撞（Clash）。

## 常见问题与修复

- **问题**：对接打分全部为正值（如 `+15.2 kcal/mol`）。  
  **原因**：Grid Box 中心坐标填错（偏离蛋白口袋落入蛋白内部骨架区）或盒子尺寸过小导致配体无法舒展。  
  **修复**：在 PyMOL 中选中原配体执行 `get_extent ligand` 重新核对中心坐标 $(x, y, z)$。
