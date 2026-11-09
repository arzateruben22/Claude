# S2E04 model check (for claims c6, c8, c10)

Share of 20,000 specks, placed uniformly over the drop, that are beyond 0.95 R of the centre when the drop is a share s of the way through its drying time (compile.py; model in its docstring):

| s | share |
|---|---|
| 0.0 | 0.101 |
| 0.3 | 0.407 |
| 0.5 | 0.566 |
| 0.8 | 0.793 |
| 0.9 | 0.880 |
| 0.95 | 0.928 |
| 0.955 | 0.934 |
| 0.99 | 0.934 |

About 10% of the specks start in that outer band (the table at s = 0.0); from s = 0.955 on the share stays where it is. The film's measure beat reads this number from the table (SHARE_TAB, the same model), so the screen, this file and c8 agree: specks still in the middle when the film gets thinner than a speck (s = 0.955) stay there, so the model ends with about nine in ten specks in the ring and the rest in the middle.
